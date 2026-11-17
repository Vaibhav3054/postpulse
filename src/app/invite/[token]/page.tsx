"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Users, CheckCircle2, XCircle, AlertCircle, LogIn } from "lucide-react";

interface InvitationInfo {
  id: string;
  workspaceName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: string;
}

function InviteAcceptContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params?.token || "";

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Invalid or expired invitation link.");
        } else {
          setInvitation(data.invitation);
        }
      } catch {
        setError("Unable to load invitation details.");
      } finally {
        setLoading(false);
      }
    };
    if (token) load();
  }, [token]);

  const handleRespond = async (action: "accept" | "reject") => {
    setActing(true);
    setError(null);
    setNeedsLogin(false);

    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setNeedsLogin(true);
        setError("Please sign in with the invited email address to respond.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Unable to process invitation.");
        return;
      }

      if (action === "accept" && data.workspaceSlug) {
        setResultMessage(`Joined ${data.workspaceName}! Redirecting...`);
        setTimeout(() => {
          router.push(`/app/${data.workspaceSlug}/dashboard`);
          router.refresh();
        }, 1200);
      } else {
        setResultMessage("Invitation declined.");
        setInvitation((prev) => (prev ? { ...prev, status: "REJECTED" } : prev));
      }
    } catch {
      setError("Network error while responding to invitation.");
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-white">Workspace Team Invitation</h1>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-400">Loading invitation...</div>
        ) : invitation ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Workspace</span>
                <span className="font-semibold text-white">{invitation.workspaceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Invited By</span>
                <span className="text-zinc-200">{invitation.invitedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Invited Email</span>
                <span className="font-mono text-zinc-200">{invitation.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Assigned Role</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-bold text-[10px]">
                  {invitation.role}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Status</span>
                <span className="font-semibold text-zinc-200">{invitation.status}</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {resultMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{resultMessage}</span>
              </div>
            )}

            {needsLogin ? (
              <div className="flex gap-2">
                <Link
                  href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </Link>
                <Link
                  href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold text-center"
                >
                  Create Account
                </Link>
              </div>
            ) : invitation.status === "PENDING" ? (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => handleRespond("accept")}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{acting ? "Processing..." : "Accept Invitation"}</span>
                </button>
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => handleRespond("reject")}
                  className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-rose-950/70 text-zinc-300 hover:text-rose-300 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Decline</span>
                </button>
              </div>
            ) : (
              <Link
                href="/app"
                className="block w-full py-2.5 text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error || "Invitation not found."}</span>
            </div>
            <Link
              href="/login"
              className="block w-full py-2.5 text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
            >
              Return to Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center text-xs">
          Loading invitation...
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}
