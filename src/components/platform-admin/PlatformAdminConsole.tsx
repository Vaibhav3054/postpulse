"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Gift,
  Sliders,
  Receipt,
  ScrollText,
  Settings,
  LogOut,
  Search,
  RefreshCw,
  Menu,
  X,
  Ban,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Lock,
} from "lucide-react";

type AdminSection =
  | "overview"
  | "users"
  | "workspaces"
  | "subscriptions"
  | "complimentary"
  | "plans"
  | "payments"
  | "audit-logs"
  | "settings";

interface AdminProps {
  admin: {
    id: string;
    email: string;
    fullName?: string | null;
  };
}

export function PlatformAdminConsole({ admin }: AdminProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminSection>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Live DB data stores
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [settingsData, setSettingsData] = useState<any>(null);
  const [savingFlagKey, setSavingFlagKey] = useState<string | null>(null);

  // Complimentary grant form state
  const [compUserId, setCompUserId] = useState("");
  const [compPlanCode, setCompPlanCode] = useState<"pro" | "agency">("pro");
  const [compDuration, setCompDuration] = useState<"7d" | "15d" | "30d" | "90d" | "custom" | "indefinite">("30d");
  const [compCustomExpiry, setCompCustomExpiry] = useState("");
  const [compIndefiniteAuth, setCompIndefiniteAuth] = useState(false);
  const [compReason, setCompReason] = useState("");
  const [submittingComp, setSubmittingComp] = useState(false);

  const notify = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  };

  const loadSection = useCallback(
    async (section: AdminSection, opts?: { search?: string; payStatus?: string }) => {
      setLoading(true);
      try {
        if (section === "overview") {
          const r = await fetch("/api/platform-admin/overview");
          if (r.ok) setOverview(await r.json());
        } else if (section === "users") {
          const q = opts?.search ?? userSearch;
          const r = await fetch(`/api/platform-admin/users?search=${encodeURIComponent(q)}`);
          if (r.ok) setUsers((await r.json()).users || []);
        } else if (section === "workspaces") {
          const r = await fetch("/api/platform-admin/workspaces");
          if (r.ok) setWorkspaces((await r.json()).workspaces || []);
        } else if (section === "subscriptions") {
          const r = await fetch("/api/platform-admin/subscriptions");
          if (r.ok) setSubscriptions((await r.json()).subscriptions || []);
        } else if (section === "complimentary") {
          const [gRes, uRes] = await Promise.all([
            fetch("/api/platform-admin/complimentary"),
            fetch("/api/platform-admin/users"),
          ]);
          if (gRes.ok) setGrants((await gRes.json()).grants || []);
          if (uRes.ok) setUsers((await uRes.json()).users || []);
        } else if (section === "plans") {
          const r = await fetch("/api/platform-admin/plans");
          if (r.ok) setPlans((await r.json()).plans || []);
        } else if (section === "payments") {
          const st = opts?.payStatus ?? paymentFilter;
          const r = await fetch(`/api/platform-admin/payments?status=${encodeURIComponent(st)}`);
          if (r.ok) setPaymentsData(await r.json());
        } else if (section === "audit-logs") {
          const r = await fetch("/api/platform-admin/audit-logs");
          if (r.ok) setAuditLogs((await r.json()).logs || []);
        } else if (section === "settings") {
          const r = await fetch("/api/platform-admin/settings");
          if (r.ok) setSettingsData(await r.json());
        }
      } catch {
        notify("error", "Failed to load platform data.");
      } finally {
        setLoading(false);
      }
    },
    [userSearch, paymentFilter]
  );

  useEffect(() => {
    loadSection(activeTab);
  }, [activeTab]);

  const handleLogout = async () => {
    await fetch("/api/platform-admin/auth/logout", { method: "POST" });
    router.push("/platform-admin/login");
    router.refresh();
  };

  const updateSocialPlatformFlags = async (
    nextFlags: { platforms: Record<string, boolean>; allowSuperAdminBypass: boolean },
    savingKey: string,
    reason: string
  ) => {
    setSavingFlagKey(savingKey);
    try {
      const res = await fetch("/api/platform-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "social_platform_flags",
          value: nextFlags,
          description: "Controls which social media integrations are live for public users vs Coming Soon",
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify("error", data.error || "Failed to update social platform availability.");
        return;
      }
      setSettingsData((prev: any) =>
        prev ? { ...prev, socialPlatformFlags: data.socialPlatformFlags || nextFlags } : prev
      );
      notify("success", reason);
    } catch {
      notify("error", "Network error while saving platform toggle.");
    } finally {
      setSavingFlagKey(null);
    }
  };

  const handleToggleSocialPlatform = async (platformKey: string, label: string) => {
    const current = settingsData?.socialPlatformFlags || {
      platforms: {
        GOOGLE_BUSINESS: true,
        FACEBOOK: true,
        INSTAGRAM: true,
        LINKEDIN: true,
        YOUTUBE: true,
      },
      allowSuperAdminBypass: true,
    };
    const nextEnabled = !(current.platforms?.[platformKey] !== false);
    const nextFlags = {
      platforms: {
        ...current.platforms,
        [platformKey]: nextEnabled,
      },
      allowSuperAdminBypass: current.allowSuperAdminBypass !== false,
    };
    await updateSocialPlatformFlags(
      nextFlags,
      platformKey,
      nextEnabled
        ? `${label} switched ON (Live for public users)`
        : `${label} switched OFF (Showing "Coming Soon" for public users)`
    );
  };

  const handleToggleSuperAdminBypass = async () => {
    const current = settingsData?.socialPlatformFlags || {
      platforms: {
        GOOGLE_BUSINESS: true,
        FACEBOOK: true,
        INSTAGRAM: true,
        LINKEDIN: true,
        YOUTUBE: true,
      },
      allowSuperAdminBypass: true,
    };
    const nextBypass = !(current.allowSuperAdminBypass !== false);
    const nextFlags = {
      platforms: { ...current.platforms },
      allowSuperAdminBypass: nextBypass,
    };
    await updateSocialPlatformFlags(
      nextFlags,
      "SUPERADMIN_BYPASS",
      nextBypass
        ? "Super Admin private testing bypass enabled"
        : "Super Admin private testing bypass disabled"
    );
  };

  const handleToggleUserStatus = async (user: any) => {
    const action = user.status === "SUSPENDED" ? "reactivate" : "suspend";
    const reason = prompt(
      `Enter audit reason to ${action.toUpperCase()} ${user.email}:`
    );
    if (!reason || reason.trim().length < 3) return;

    const res = await fetch("/api/platform-admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify("success", `User ${user.email} ${action === "suspend" ? "suspended" : "reactivated"}.`);
      loadSection("users");
    } else {
      notify("error", data.error || "Action failed.");
    }
  };

  const handleSubAction = async (
    sub: any,
    action: "extend" | "cancel" | "revoke" | "restore" | "upgrade" | "downgrade",
    extra?: Record<string, unknown>
  ) => {
    const reason = prompt(`Enter audit reason for ${action.toUpperCase()} on ${sub.user?.email}:`);
    if (!reason || reason.trim().length < 3) return;

    const res = await fetch("/api/platform-admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        userId: sub.userId,
        subscriptionId: sub.id,
        reason: reason.trim(),
        ...extra,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify("success", `Subscription ${action} completed.`);
      loadSection("subscriptions");
    } else {
      notify("error", data.error || "Subscription action failed.");
    }
  };

  const handleGrantComplimentary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compUserId) {
      notify("error", "Please select a customer first.");
      return;
    }
    setSubmittingComp(true);
    try {
      const res = await fetch("/api/platform-admin/complimentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: compUserId,
          planCode: compPlanCode,
          durationType: compDuration,
          customExpiryDate:
            compDuration === "custom" && compCustomExpiry
              ? new Date(compCustomExpiry).toISOString()
              : undefined,
          authorizeIndefinite: compDuration === "indefinite" ? compIndefiniteAuth : false,
          reason: compReason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        notify("success", "Complimentary subscription activated (₹0 revenue recorded).");
        setCompReason("");
        setCompIndefiniteAuth(false);
        loadSection("complimentary");
      } else {
        notify("error", data.error || "Failed to grant complimentary access.");
      }
    } finally {
      setSubmittingComp(false);
    }
  };

  const handleRevokeComplimentary = async (grant: any) => {
    const reason = prompt(`Enter reason to immediately revoke complimentary access for ${grant.user?.email}:`);
    if (!reason || reason.trim().length < 3) return;

    const res = await fetch("/api/platform-admin/complimentary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: grant.id, reason: reason.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify("success", "Complimentary access revoked; customer downgraded to Free.");
      loadSection("complimentary");
    } else {
      notify("error", data.error || "Revocation failed.");
    }
  };

  const handleUpdatePlan = async (plan: any) => {
    const res = await fetch("/api/platform-admin/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: plan.id,
        name: plan.name,
        priceMonthlyInr: Number(plan.priceMonthlyInr),
        priceAnnualInr: Number(plan.priceAnnualInr),
        maxWorkspaces: Number(plan.maxWorkspaces),
        maxSocialAccounts: Number(plan.maxSocialAccounts),
        maxScheduledPostsPerMonth: Number(plan.maxScheduledPostsPerMonth),
        maxStorageMb: Number(plan.maxStorageMb),
        maxTeamMembers: Number(plan.maxTeamMembers),
        razorpayPlanIdMonthly: plan.razorpayPlanIdMonthly || null,
        razorpayPlanIdAnnual: plan.razorpayPlanIdAnnual || null,
        isActive: Boolean(plan.isActive),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      notify("success", `Plan "${plan.name}" updated cleanly without altering customer history.`);
      loadSection("plans");
    } else {
      notify("error", data.error || "Failed to update plan.");
    }
  };

  const navItems: { id: AdminSection; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "workspaces", label: "Workspaces", icon: Building2 },
    { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
    { id: "complimentary", label: "Complimentary Access", icon: Gift },
    { id: "plans", label: "Plans & Pricing", icon: Sliders },
    { id: "payments", label: "Payments", icon: Receipt },
    { id: "audit-logs", label: "Activity Logs", icon: ScrollText },
    { id: "settings", label: "Platform Settings", icon: Settings },
  ];

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-tight">PostPulse Admin</div>
            <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
              Super Admin Panel
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="md:hidden p-1 text-zinc-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-zinc-800 space-y-2">
        <div className="px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
          <div className="text-xs font-semibold text-white truncate">
            {admin.fullName || "Super Admin"}
          </div>
          <div className="text-[10px] text-zinc-400 truncate">{admin.email}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-rose-950/60 text-zinc-300 hover:text-rose-300 border border-zinc-800 text-xs font-semibold transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out Admin</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 bg-zinc-950 border-r border-zinc-800 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-64 bg-zinc-950 border-r border-zinc-800 h-full shadow-2xl">
            {renderSidebarContent()}
          </div>
          <div
            className="flex-1 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-white capitalize truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => loadSection(activeTab)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {toast && (
          <div
            className={`fixed top-16 right-4 z-50 max-w-md px-4 py-3 rounded-xl text-xs font-semibold text-white shadow-2xl ${
              toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {toast.text}
          </div>
        )}

        <main className="p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6 overflow-x-hidden">
          {/* OVERVIEW */}
          {activeTab === "overview" && overview?.metrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: "Total Users", value: overview.metrics.totalUsers, sub: `${overview.metrics.activeUsers} active • ${overview.metrics.suspendedUsers} suspended` },
                  { label: "Total Workspaces", value: overview.metrics.totalWorkspaces, sub: "Tenant-isolated brands" },
                  { label: "Monthly Recurring Revenue", value: `₹${overview.metrics.mrrInr.toLocaleString("en-IN")}`, sub: "Verified active paid plans only" },
                  { label: "Total Verified Revenue", value: `₹${overview.metrics.totalVerifiedRevenueInr.toLocaleString("en-IN")}`, sub: `${overview.metrics.totalVerifiedPayments} captured • ${overview.metrics.failedPayments} failed` },
                  { label: "Free Plan Users", value: overview.metrics.freeSubscriptions, sub: "Free Starter tier" },
                  { label: "Pro Subscriptions", value: overview.metrics.proSubscriptions, sub: "Active Pro entitlements" },
                  { label: "Agency Subscriptions", value: overview.metrics.agencySubscriptions, sub: "Active Agency entitlements" },
                  { label: "Paid vs. Complimentary", value: `${overview.metrics.activePaidSubscriptions} / ${overview.metrics.activeComplimentarySubscriptions}`, sub: `${overview.metrics.expiredSubscriptions} expired/revoked` },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1"
                  >
                    <div className="text-[11px] font-medium text-zinc-400">{kpi.label}</div>
                    <div className="text-xl sm:text-2xl font-bold text-white">{kpi.value}</div>
                    <div className="text-[11px] text-zinc-500">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Recent Super Admin Audit Events
                </h2>
                <div className="divide-y divide-zinc-800 text-xs">
                  {(overview.recentAuditLogs || []).length === 0 ? (
                    <div className="py-4 text-zinc-500">No audit events recorded yet.</div>
                  ) : (
                    overview.recentAuditLogs.map((log: any) => (
                      <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 mr-2">
                            {log.action}
                          </span>
                          <span className="text-zinc-200">{log.adminEmail}</span>
                          {log.targetEmail && (
                            <span className="text-zinc-400"> → {log.targetEmail}</span>
                          )}
                          {log.reason && <span className="text-zinc-500"> — {log.reason}</span>}
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadSection("users", { search: userSearch })}
                    placeholder="Search customers by name or email..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadSection("users", { search: userSearch })}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                >
                  Search
                </button>
              </div>

              <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Registered</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Workspaces</th>
                      <th className="p-3">Subscription</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="p-3">
                          <div className="font-semibold text-white">{u.fullName || "Unnamed"}</div>
                          <div className="text-[11px] text-zinc-400">{u.email}</div>
                        </td>
                        <td className="p-3 text-zinc-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-950 text-emerald-400"
                                : "bg-rose-950 text-rose-400"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3 text-zinc-300">{u.ownedWorkspaceCount} owned</td>
                        <td className="p-3">
                          {u.subscription ? (
                            <span className="text-[11px] font-medium text-indigo-300">
                              {u.subscription.planName} ({u.subscription.source} • {u.subscription.status})
                            </span>
                          ) : (
                            <span className="text-zinc-500">Free Starter</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                              u.status === "SUSPENDED"
                                ? "bg-emerald-950 text-emerald-300 hover:bg-emerald-900"
                                : "bg-rose-950 text-rose-300 hover:bg-rose-900"
                            }`}
                          >
                            {u.status === "SUSPENDED" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Reactivate
                              </>
                            ) : (
                              <>
                                <Ban className="w-3 h-3" /> Suspend
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* WORKSPACES */}
          {activeTab === "workspaces" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Privacy isolation enforced: Private customer posts, media files, messages, and social OAuth tokens are strictly excluded from Platform Admin APIs.
                </span>
              </div>

              <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Workspace</th>
                      <th className="p-3">Owner</th>
                      <th className="p-3">Created</th>
                      <th className="p-3">Members</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Owner Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {workspaces.map((w) => (
                      <tr key={w.id}>
                        <td className="p-3">
                          <div className="font-semibold text-white">{w.name}</div>
                          <div className="text-[10px] font-mono text-zinc-500">/{w.slug}</div>
                        </td>
                        <td className="p-3">
                          <div className="text-zinc-200">{w.ownerName || "—"}</div>
                          <div className="text-[11px] text-zinc-400">{w.ownerEmail}</div>
                        </td>
                        <td className="p-3 text-zinc-400">
                          {new Date(w.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-zinc-300">{w.memberCount}</td>
                        <td className="p-3 uppercase font-semibold text-indigo-300">{w.planName}</td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              w.ownerStatus === "ACTIVE"
                                ? "bg-emerald-950 text-emerald-400"
                                : "bg-rose-950 text-rose-400"
                            }`}
                          >
                            {w.ownerStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS */}
          {activeTab === "subscriptions" && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Source</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Expiry</th>
                    <th className="p-3 text-right">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-zinc-500">
                        No paid or complimentary subscriptions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((s) => (
                      <tr key={s.id}>
                        <td className="p-3">
                          <div className="font-semibold text-white">{s.user?.fullName || "—"}</div>
                          <div className="text-[11px] text-zinc-400">{s.user?.email}</div>
                        </td>
                        <td className="p-3 font-semibold text-indigo-300">{s.plan?.name}</td>
                        <td className="p-3">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              s.source === "PAID"
                                ? "bg-emerald-950 text-emerald-300"
                                : s.source === "COMPLIMENTARY"
                                  ? "bg-purple-950 text-purple-300"
                                  : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {s.source}
                          </span>
                        </td>
                        <td className="p-3 uppercase font-semibold text-zinc-200">{s.status}</td>
                        <td className="p-3 text-zinc-400">
                          {s.isIndefinite
                            ? "Indefinite"
                            : s.currentPeriodEnd
                              ? new Date(s.currentPeriodEnd).toLocaleDateString()
                              : "—"}
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleSubAction(s, "extend", { extendDays: 30 })}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200"
                          >
                            +30d
                          </button>
                          {s.status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => handleSubAction(s, "revoke")}
                              className="px-2 py-1 rounded bg-rose-950 hover:bg-rose-900 text-[11px] text-rose-300"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSubAction(s, "restore")}
                              className="px-2 py-1 rounded bg-emerald-950 hover:bg-emerald-900 text-[11px] text-emerald-300"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* COMPLIMENTARY ACCESS */}
          {activeTab === "complimentary" && (
            <div className="space-y-6">
              <form
                onSubmit={handleGrantComplimentary}
                className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      <Gift className="w-4 h-4 text-purple-400" />
                      Grant Complimentary Access
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Complimentary grants are strictly tracked separately from Paid plans and generate ₹0 fake payment revenue.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">1. Select Customer</label>
                    <select
                      required
                      value={compUserId}
                      onChange={(e) => setCompUserId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white"
                    >
                      <option value="">-- Choose registered customer --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email} ({u.fullName || "Unnamed"})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">2. Complimentary Plan</label>
                    <select
                      value={compPlanCode}
                      onChange={(e) => setCompPlanCode(e.target.value as "pro" | "agency")}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white"
                    >
                      <option value="pro">Pro Creator (3 workspaces, 10 accounts)</option>
                      <option value="agency">Agency (50 workspaces, 50 accounts)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">3. Duration</label>
                    <select
                      value={compDuration}
                      onChange={(e) => setCompDuration(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white"
                    >
                      <option value="7d">7 Days</option>
                      <option value="15d">15 Days</option>
                      <option value="30d">30 Days</option>
                      <option value="90d">90 Days</option>
                      <option value="custom">Custom Expiry Date</option>
                      <option value="indefinite">Indefinite (Requires Explicit Authorization)</option>
                    </select>
                  </div>
                </div>

                {compDuration === "custom" && (
                  <div className="max-w-xs space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Custom Expiry Date</label>
                    <input
                      type="date"
                      required
                      value={compCustomExpiry}
                      onChange={(e) => setCompCustomExpiry(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white"
                    />
                  </div>
                )}

                {compDuration === "indefinite" && (
                  <label className="flex items-center gap-2 p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-xs text-amber-200">
                    <input
                      type="checkbox"
                      checked={compIndefiniteAuth}
                      onChange={(e) => setCompIndefiniteAuth(e.target.checked)}
                    />
                    <span>
                      I explicitly authorize indefinite complimentary access without automatic expiry for this customer.
                    </span>
                  </label>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">
                    4. Reason (Mandatory for Audit Log)
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    placeholder="e.g., Partner clinic trial — approved by founder"
                    className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingComp}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-xs font-semibold text-white"
                >
                  {submittingComp ? "Activating..." : "Confirm & Activate Complimentary Access"}
                </button>
              </form>

              <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Expires</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {grants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          No complimentary grants issued yet.
                        </td>
                      </tr>
                    ) : (
                      grants.map((g) => (
                        <tr key={g.id}>
                          <td className="p-3">
                            <div className="font-semibold text-white">{g.user?.email}</div>
                          </td>
                          <td className="p-3 text-purple-300 font-semibold">{g.plan?.name}</td>
                          <td className="p-3 uppercase font-semibold">{g.status}</td>
                          <td className="p-3 text-zinc-400">
                            {g.isIndefinite
                              ? "Indefinite"
                              : g.currentPeriodEnd
                                ? new Date(g.currentPeriodEnd).toLocaleDateString()
                                : "—"}
                          </td>
                          <td className="p-3 text-zinc-400 max-w-xs truncate">
                            {g.complimentaryReason || "—"}
                          </td>
                          <td className="p-3 text-right">
                            {g.status === "ACTIVE" && (
                              <button
                                type="button"
                                onClick={() => handleRevokeComplimentary(g)}
                                className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-[11px] font-semibold text-rose-300"
                              >
                                Revoke Immediately
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PLANS & PRICING */}
          {activeTab === "plans" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {plans.map((plan, idx) => (
                <div
                  key={plan.id}
                  className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {plan.code}
                      </span>
                      <span className="ml-2 text-xs text-zinc-500">
                        {plan._count?.workspaces || 0} workspaces
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={plan.isActive}
                        onChange={(e) => {
                          const copy = [...plans];
                          copy[idx] = { ...plan, isActive: e.target.checked };
                          setPlans(copy);
                        }}
                      />
                      Active
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { key: "name", label: "Plan Name", type: "text" },
                      { key: "priceMonthlyInr", label: "Monthly (₹)", type: "number" },
                      { key: "priceAnnualInr", label: "Annual (₹)", type: "number" },
                      { key: "maxWorkspaces", label: "Max Workspaces", type: "number" },
                      { key: "maxSocialAccounts", label: "Max Accounts", type: "number" },
                      { key: "maxScheduledPostsPerMonth", label: "Max Posts/Mo", type: "number" },
                      { key: "maxStorageMb", label: "Storage (MB)", type: "number" },
                      { key: "maxTeamMembers", label: "Team Seats", type: "number" },
                      { key: "razorpayPlanIdMonthly", label: "Razorpay Monthly Plan ID", type: "text" },
                      { key: "razorpayPlanIdAnnual", label: "Razorpay Annual Plan ID", type: "text" },
                    ].map((field) => (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[11px] text-zinc-400">{field.label}</label>
                        <input
                          type={field.type}
                          value={plan[field.key] ?? ""}
                          onChange={(e) => {
                            const copy = [...plans];
                            copy[idx] = {
                              ...plan,
                              [field.key]:
                                field.type === "number" ? Number(e.target.value) : e.target.value,
                            };
                            setPlans(copy);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-xs"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdatePlan(plan)}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
                  >
                    Save Plan Definition
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "payments" && paymentsData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Verified Revenue</div>
                  <div className="text-xl font-bold text-emerald-400 flex items-center gap-0.5 mt-1">
                    <IndianRupee className="w-4 h-4" />
                    {paymentsData.summary.verifiedRevenueInr.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Captured Payments</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {paymentsData.summary.capturedCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Failed Payments</div>
                  <div className="text-xl font-bold text-rose-400 mt-1">
                    {paymentsData.summary.failedCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Refunds Processed</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {paymentsData.summary.refundedCount} (₹{paymentsData.summary.refundedTotalInr})
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {["ALL", "CAPTURED", "FAILED", "REFUNDED"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setPaymentFilter(st);
                      loadSection("payments", { payStatus: st });
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      paymentFilter === st
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Plan</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Razorpay Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {(paymentsData.transactions || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-zinc-500">
                          No payment transactions found.
                        </td>
                      </tr>
                    ) : (
                      paymentsData.transactions.map((tx: any) => (
                        <tr key={tx.id}>
                          <td className="p-3 text-zinc-400">
                            {new Date(tx.paidAt || tx.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 text-zinc-200">{tx.user?.email}</td>
                          <td className="p-3 uppercase font-semibold">{tx.planCode}</td>
                          <td className="p-3 font-bold text-white">
                            ₹{(tx.amountPaise / 100).toLocaleString("en-IN")}
                          </td>
                          <td className="p-3 uppercase font-bold">{tx.status}</td>
                          <td className="p-3 font-mono text-[11px] text-zinc-400">
                            {tx.razorpayPaymentId || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeTab === "audit-logs" && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 text-[11px] text-zinc-400 uppercase">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Admin</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Reason</th>
                    <th className="p-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="p-3 text-zinc-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-zinc-200">{log.adminEmail}</td>
                      <td className="p-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-300">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 text-zinc-300">{log.targetEmail || log.entityId || "—"}</td>
                      <td className="p-3 text-zinc-400 max-w-xs truncate">{log.reason || "—"}</td>
                      <td className="p-3 font-mono text-[11px] text-zinc-500">{log.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* PLATFORM SETTINGS */}
          {activeTab === "settings" && settingsData?.integrations && (
            <div className="space-y-4">
              {/* Social Channel Availability Switches */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Social Channel Availability (Public / Coming Soon)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Toggle any social platform OFF to immediately show &ldquo;Coming Soon&rdquo; and block new public connections — no redeploy needed.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/70 self-start sm:self-auto">
                    Instant Live Control
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: "GOOGLE_BUSINESS", label: "Google Business Profile", hint: "Google Maps & local posts" },
                    { key: "FACEBOOK", label: "Facebook Pages", hint: "Meta Pages publishing" },
                    { key: "INSTAGRAM", label: "Instagram Professional", hint: "Meta Creator / Business" },
                    { key: "LINKEDIN", label: "LinkedIn", hint: "Profiles & Company Pages" },
                    { key: "YOUTUBE", label: "YouTube Channel", hint: "Videos & Shorts" },
                  ].map((item) => {
                    const enabled = settingsData?.socialPlatformFlags?.platforms?.[item.key] !== false;
                    const oauthStatus = settingsData.integrations.socialProviders?.[item.key];
                    const busy = savingFlagKey === item.key;

                    return (
                      <div
                        key={item.key}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                          enabled
                            ? "bg-zinc-950/70 border-zinc-800"
                            : "bg-indigo-950/20 border-indigo-900/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white truncate">
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                enabled
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800/70"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-800/70"
                              }`}
                            >
                              {enabled ? "Live for Public" : "Coming Soon"}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {oauthStatus?.mode === "live" ? "OAuth Live" : "Sandbox"}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          disabled={busy}
                          onClick={() => handleToggleSocialPlatform(item.key, item.label)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                            enabled ? "bg-emerald-500" : "bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                              enabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Super Admin Bypass Option */}
                <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-zinc-200">
                      Allow Super Admin Private Testing Bypass
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      When enabled, Super Admin accounts can still connect and test &ldquo;Coming Soon&rdquo; platforms privately while public users see Coming Soon.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settingsData?.socialPlatformFlags?.allowSuperAdminBypass !== false}
                    disabled={savingFlagKey === "SUPERADMIN_BYPASS"}
                    onClick={handleToggleSuperAdminBypass}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors self-start sm:self-auto disabled:opacity-50 ${
                      settingsData?.socialPlatformFlags?.allowSuperAdminBypass !== false
                        ? "bg-indigo-500"
                        : "bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        settingsData?.socialPlatformFlags?.allowSuperAdminBypass !== false
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Infrastructure Readiness</h2>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-zinc-800">
                    <span className="text-zinc-400">Supabase Cloud Storage</span>
                    <span className={settingsData.integrations.storage.isConfigured ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                      {settingsData.integrations.storage.isConfigured
                        ? `Configured (${settingsData.integrations.storage.bucket})`
                        : "Unconfigured"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800">
                    <span className="text-zinc-400">Razorpay Gateway</span>
                    <span className={settingsData.integrations.razorpay.isConfigured ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                      {settingsData.integrations.razorpay.isConfigured
                        ? settingsData.integrations.razorpay.isTestMode
                          ? "Test Mode Active"
                          : "Live Mode Active"
                        : "Awaiting API Keys"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-800">
                    <span className="text-zinc-400">Resend Email Adapter</span>
                    <span className={settingsData.integrations.email.isConfigured ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                      {settingsData.integrations.email.isConfigured ? "Live Resend" : "Sandbox (In-App Active)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-400">Netlify Scheduled Publishing Cron</span>
                    <span className={settingsData.integrations.cron.hasCronSecret ? "text-emerald-400 font-semibold" : "text-amber-400"}>
                      {settingsData.integrations.cron.hasCronSecret ? "CRON_SECRET Configured" : "Set CRON_SECRET"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Social Provider OAuth Status</h2>
                <div className="space-y-2 text-xs">
                  {Object.values(settingsData.integrations.socialProviders || {}).map((p: any) => (
                    <div
                      key={p.platform}
                      className="flex justify-between py-1.5 border-b border-zinc-800 last:border-0"
                    >
                      <span className="text-zinc-300">{p.platform}</span>
                      <span
                        className={
                          p.mode === "live"
                            ? "text-emerald-400 font-semibold"
                            : "text-amber-400 font-semibold"
                        }
                      >
                        {p.mode === "live" ? "Live Official OAuth" : "Sandbox Mode"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
