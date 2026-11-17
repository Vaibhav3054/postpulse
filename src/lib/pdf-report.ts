"use client";

export interface ReportPostItem {
  id: string;
  caption: string;
  mediaUrl?: string;
  publishedAt?: string;
  platforms: string[];
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  status: string;
}

export interface PdfReportPayload {
  workspaceName: string;
  reportTitle: string;
  generatedAtIST: string;
  summary: {
    totalPosts: number;
    totalImpressions: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    engagementRate: string;
  };
  platformBreakdown: {
    platform: string;
    engagements: number;
    percentage: number;
    color: string;
  }[];
  posts: ReportPostItem[];
}

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : "#4f46e5";
}

function sanitizeMediaUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) {
    return escapeHtml(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return escapeHtml(parsed.toString());
    }
  } catch {
    return null;
  }
  return null;
}

export function generateAndPrintPdfReport(data: PdfReportPayload) {
  // Create an isolated printable iframe
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    alert("Unable to open print preview.");
    return;
  }

  const safeReportTitle = escapeHtml(data.reportTitle);
  const safeWorkspaceName = escapeHtml(data.workspaceName);
  const safeGeneratedAt = escapeHtml(data.generatedAtIST);
  const safeEngagementRate = escapeHtml(data.summary.engagementRate);

  const platformDotsHtml = data.platformBreakdown
    .map(
      (p) => `
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; margin-bottom: 4px;">
        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${sanitizeColor(p.color)}; display: inline-block;"></span>
        <span style="font-weight: 600; color: #1f2937;">${escapeHtml(p.platform)}:</span>
        <span style="color: #4b5563;">${Number(p.engagements || 0).toLocaleString()} (${Number(p.percentage || 0)}%)</span>
      </div>
    `
    )
    .join("");

  const postsRowsHtml = data.posts
    .map((p, idx) => {
      const safeMediaUrl = sanitizeMediaUrl(p.mediaUrl);
      const safeCaption = escapeHtml(p.caption || "Untitled Post");
      const safePublishedAt = escapeHtml(p.publishedAt || "Recently Published");
      const safePlatforms = escapeHtml((p.platforms || []).join(", "));
      const safeStatus = escapeHtml(p.status);
      return `
      <tr style="border-bottom: 1px solid #e5e7eb; page-break-inside: avoid;">
        <td style="padding: 10px 8px; font-size: 11px; color: #6b7280; font-family: monospace;">#${idx + 1}</td>
        <td style="padding: 10px 8px;">
          ${
            safeMediaUrl
              ? `<img src="${safeMediaUrl}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; margin-bottom: 4px;" alt="media" />`
              : `<div style="width: 44px; height: 44px; border-radius: 6px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #9ca3af;">Text</div>`
          }
        </td>
        <td style="padding: 10px 8px; max-width: 260px;">
          <div style="font-size: 11px; font-weight: 600; color: #111827; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
            ${safeCaption}
          </div>
          <div style="font-size: 10px; color: #6b7280; margin-top: 3px;">
            ${safePublishedAt} • <strong style="color: #4f46e5;">${safePlatforms}</strong>
          </div>
        </td>
        <td style="padding: 10px 8px; font-size: 11px; text-align: right; font-weight: 600; color: #111827;">${Number(p.impressions || 0).toLocaleString()}</td>
        <td style="padding: 10px 8px; font-size: 11px; text-align: right; color: #374151;">${Number(p.likes || 0).toLocaleString()}</td>
        <td style="padding: 10px 8px; font-size: 11px; text-align: right; color: #374151;">${Number(p.comments || 0).toLocaleString()}</td>
        <td style="padding: 10px 8px; font-size: 11px; text-align: right; color: #374151;">${Number(p.shares || 0).toLocaleString()}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: 700; border-radius: 9999px; text-transform: uppercase; background: #ecfdf5; color: #047857;">
            ${safeStatus}
          </span>
        </td>
      </tr>
    `;
    })
    .join("");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${safeReportTitle} - ${safeWorkspaceName}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .logo-badge {
            width: 32px;
            height: 32px;
            background: #4f46e5;
            color: #ffffff;
            font-weight: 800;
            font-size: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
          }
          .kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            margin-bottom: 24px;
          }
          .kpi-card {
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            border-radius: 10px;
            padding: 12px 14px;
          }
          .kpi-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #6b7280;
          }
          .kpi-value {
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            margin-top: 4px;
          }
          .kpi-sub {
            font-size: 10px;
            color: #059669;
            margin-top: 2px;
            font-weight: 500;
          }
          .section-title {
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #374151;
            margin-bottom: 12px;
            border-left: 3px solid #4f46e5;
            padding-left: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
          }
          th {
            background: #f3f4f6;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #4b5563;
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
          }
          .footer {
            margin-top: 32px;
            padding-top: 12px;
            border-top: 1px solid #e5e7eb;
            font-size: 10px;
            color: #9ca3af;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <div>
            <div class="brand">
              <div class="logo-badge">P</div>
              <div>
                <div style="font-size: 18px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">PostPulse</div>
                <div style="font-size: 11px; color: #6b7280;">Social Media SaaS • Performance Report</div>
              </div>
            </div>
            <div style="margin-top: 12px; font-size: 15px; font-weight: 700; color: #111827;">${safeReportTitle}</div>
            <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">Workspace: <strong>${safeWorkspaceName}</strong></div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6b7280;">Timing / Timezone</div>
            <div style="font-size: 11px; color: #111827; font-weight: 600; margin-top: 2px;">${safeGeneratedAt}</div>
            <div style="margin-top: 8px; font-size: 10px; color: #059669; font-weight: 600;">Verified Platform Data</div>
          </div>
        </div>

        <!-- Executive Summary KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">Total Impressions</div>
            <div class="kpi-value">${data.summary.totalImpressions.toLocaleString()}</div>
            <div class="kpi-sub">Audience Reach</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Likes</div>
            <div class="kpi-value">${data.summary.totalLikes.toLocaleString()}</div>
            <div class="kpi-sub">Direct Reactions</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Comments & Shares</div>
            <div class="kpi-value">${(data.summary.totalComments + data.summary.totalShares).toLocaleString()}</div>
            <div class="kpi-sub">${data.summary.totalComments} com • ${data.summary.totalShares} sh</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Engagement Rate</div>
            <div class="kpi-value">${safeEngagementRate}</div>
            <div class="kpi-sub">Across ${Number(data.summary.totalPosts || 0)} post(s)</div>
          </div>
        </div>

        <!-- Network Breakdown Strip -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 6px;">PLATFORM SHARE BREAKDOWN:</div>
          <div style="display: flex; gap: 20px; flex-wrap: wrap;">
            ${platformDotsHtml || `<div style="font-size: 11px; color: #94a3b8;">No platform metrics recorded yet</div>`}
          </div>
        </div>

        <!-- Posts Table -->
        <div class="section-title">Detailed Content Performance (${data.posts.length} Post${data.posts.length === 1 ? "" : "s"})</div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left; width: 30px;">#</th>
              <th style="text-align: left; width: 50px;">Media</th>
              <th style="text-align: left;">Caption & Channels</th>
              <th style="text-align: right;">Reach</th>
              <th style="text-align: right;">Likes</th>
              <th style="text-align: right;">Comments</th>
              <th style="text-align: right;">Shares</th>
              <th style="text-align: center; width: 75px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${postsRowsHtml}
          </tbody>
        </table>

        <!-- Footer -->
        <div class="footer">
          <div>Generated by PostPulse Social Media SaaS • Verified Official APIs Only</div>
          <div>Confidential & Proprietary • ${safeWorkspaceName}</div>
        </div>
      </body>
    </html>
  `;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  // Trigger print dialog once loaded
  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 400);
}
