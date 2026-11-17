"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  XCircle,
  Shield,
} from "lucide-react";

interface MemberItem {
  id: string;
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  email: string;
  fullName?: string | null;
}

interface InvitationItem {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: string;
  expiresAt: string;
  invitedBy: string;
}

interface TeamManagementCardProps {
  workspaceId: string;
  currentRole: string;
}

export function TeamManagementCard({ workspaceId, currentRole }: TeamManagementCardProps) {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [quota, setQuota] = useState<{
    usedSeats: number;
    pendingInvitations: number;
    maxTeamMembers: number;
    planName: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canManage = currentRole === "OWNER" || currentRole === "ADMIN";
  const isOwner = currentRole === "OWNER";

  const loadTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
        setQuota(data.quota || null);
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setGeneratedLink(null);

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to send invitation.");
        return;
      }

      setInviteEmail("");
      setGeneratedLink(data.inviteUrl || null);
      await loadTeam();
    } catch {
      setError("Network error while sending invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/invitations`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setGeneratedLink(data.inviteUrl || null);
      await loadTeam();
    } else {
      setError(data.error || "Failed to resend invitation.");
    }
  };

  const handleRevoke = async (invitationId: string) => {
    setError(null);
    const res = await fetch(
      `/api/workspaces/${workspaceId}/invitations?invitationId=${encodeURIComponent(invitationId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadTeam();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to revoke invitation.");
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "ADMIN" | "MEMBER") => {
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId, role: newRole }),
    });
    if (res.ok) {
      await loadTeam();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (member: MemberItem) => {
    if (!confirm(`Remove ${member.email} from this workspace?`)) return;
    setError(null);
    const res = await fetch(
      `/api/workspaces/${workspaceId}/members?memberId=${encodeURIComponent(member.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadTeam();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to remove team member.");
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="p-5 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Team Members &amp; Invitations
            </h3>
            <p className="text-xs text-zinc-500">
              Invite collaborators scoped strictly to this workspace with role-based permissions.
            </p>
          </div>
        </div>
        {quota && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 self-start sm:self-auto">
            {quota.usedSeats + quota.pendingInvitations} / {quota.maxTeamMembers} seats ({quota.planName})
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      )}

      {generatedLink && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Invitation created! Share this secure one-time invite link:
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-white dark:bg-zinc-950 border border-emerald-200 dark:border-emerald-900 rounded-lg text-zinc-800 dark:text-zinc-200"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}

      {canManage && (
        <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "MEMBER" | "ADMIN")}
            className="px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white"
          >
            <option value="MEMBER">Member (Create &amp; Schedule)</option>
            {isOwner && <option value="ADMIN">Admin (Manage Accounts &amp; Members)</option>}
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{submitting ? "Inviting..." : "Send Invite"}</span>
          </button>
        </form>
      )}

      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Active Members ({members.length})
        </div>
        {loading ? (
          <div className="text-xs text-zinc-500 py-3">Loading team...</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {members.map((m) => (
              <div
                key={m.id}
                className="p-3 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/40 dark:bg-zinc-950/30"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                    {m.fullName || m.email}
                  </div>
                  <div className="text-[11px] text-zinc-500 truncate">{m.email}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwner && m.role !== "OWNER" ? (
                    <select
                      value={m.role}
                      onChange={(e) =>
                        handleChangeRole(m.id, e.target.value as "ADMIN" | "MEMBER")
                      }
                      className="px-2 py-1 text-[11px] font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold uppercase">
                      <Shield className="w-3 h-3" />
                      {m.role}
                    </span>
                  )}

                  {canManage &&
                    m.role !== "OWNER" &&
                    !(currentRole === "ADMIN" && m.role === "ADMIN") && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m)}
                        title="Remove member"
                        className="p-1 text-zinc-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && invitations.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            Pending Invitations ({invitations.length})
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="p-3 flex flex-wrap items-center justify-between gap-3 bg-amber-50/30 dark:bg-amber-950/10"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                    {inv.email}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Role: {inv.role} • Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleResend(inv.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-200"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(inv.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-[11px] font-semibold text-rose-600 dark:text-rose-300"
                  >
                    <XCircle className="w-3 h-3" />
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
