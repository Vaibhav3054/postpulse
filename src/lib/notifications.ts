import { NotificationType } from "@prisma/client";
import { prisma } from "./prisma";

export interface EmailSendParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailSendResult {
  sent: boolean;
  mode: "live_resend" | "sandbox_unconfigured" | "error";
  providerMessageId?: string;
  error?: string;
}

export function isEmailProviderConfigured(): boolean {
  const key = (process.env.RESEND_API_KEY || "").trim();
  return Boolean(key && !key.startsWith("re_your_") && key !== "your_resend_api_key");
}

/**
 * Sends a transactional email via Resend REST API when RESEND_API_KEY is configured.
 * Falls back gracefully in sandbox/dev mode without throwing when credentials are not yet set.
 */
export async function sendTransactionalEmail(params: EmailSendParams): Promise<EmailSendResult> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const cleanRecipients = recipients.map((r) => r.trim()).filter(Boolean);
  if (cleanRecipients.length === 0) {
    return { sent: false, mode: "sandbox_unconfigured", error: "No recipients" };
  }

  if (!isEmailProviderConfigured()) {
    console.info(
      `[Email Sandbox] RESEND_API_KEY not configured. Would send "${params.subject}" to ${cleanRecipients.join(", ")}`
    );
    return { sent: false, mode: "sandbox_unconfigured" };
  }

  const fromAddress =
    process.env.EMAIL_FROM?.trim() || "PostPulse Notifications <notifications@postpulse.io>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: cleanRecipients,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[Resend Email Error]", res.status, data);
      return {
        sent: false,
        mode: "error",
        error: (data as { message?: string }).message || `HTTP ${res.status}`,
      };
    }

    return {
      sent: true,
      mode: "live_resend",
      providerMessageId: (data as { id?: string }).id,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Resend Email Exception]", error.message);
    return { sent: false, mode: "error", error: error.message };
  }
}

export interface CreateNotificationInput {
  workspaceId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  sendEmailToAdmins?: boolean;
}

/**
 * Creates a persistent in-app workspace notification and optionally dispatches an email alert
 * to the workspace owner/admins (via Resend when configured).
 */
export async function createWorkspaceNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId || null,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
      metadata: (input.metadata || {}) as object,
    },
  });

  if (input.sendEmailToAdmins) {
    const admins = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: input.workspaceId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      include: {
        user: { select: { email: true, status: true } },
        workspace: { select: { name: true, slug: true } },
      },
    });

    const adminEmails = admins
      .filter((m) => m.user.status === "ACTIVE")
      .map((m) => m.user.email);

    if (adminEmails.length > 0) {
      const wsName = admins[0]?.workspace.name || "Your Workspace";
      const appUrl = (process.env.APP_URL || "https://postpulse-saas.netlify.app").replace(/\/$/, "");
      const dashboardLink = `${appUrl}/app/${admins[0]?.workspace.slug || ""}/posts`;

      await sendTransactionalEmail({
        to: adminEmails,
        subject: `[PostPulse - ${wsName}] ${input.title}`,
        text: `${input.title}\n\n${input.message}\n\nReview in PostPulse: ${dashboardLink}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111827;">
            <h2 style="margin: 0 0 12px; font-size: 18px; color: #111827;">${input.title}</h2>
            <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5; color: #374151;">${input.message}</p>
            <a href="${dashboardLink}" style="display: inline-block; padding: 10px 18px; background: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Open PostPulse Dashboard</a>
          </div>
        `,
      }).catch(() => {});
    }
  }

  return notification;
}
