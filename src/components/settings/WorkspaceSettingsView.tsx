"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sparkles,
  Check,
  AlertTriangle,
  Trash2,
  CreditCard,
  Receipt,
  Gift,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { PlanLimits } from "@/lib/quota";
import { TeamManagementCard } from "./TeamManagementCard";

interface ActiveSubscriptionInfo {
  id: string;
  source: "FREE" | "PAID" | "COMPLIMENTARY";
  billingInterval: "MONTHLY" | "ANNUAL" | "NONE";
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isIndefinite: boolean;
  complimentaryReason?: string | null;
}

interface CatalogPlan {
  code: string;
  name: string;
  priceMonthlyInr: number;
  priceAnnualInr: number;
  maxWorkspaces: number;
  maxSocialAccounts: number;
  maxScheduledPostsPerMonth: number;
  maxStorageMb: number;
  maxTeamMembers: number;
  features: string[];
}

interface PaymentTransactionItem {
  id: string;
  planCode: string;
  billingInterval: string;
  amountPaise: number;
  currency: string;
  status: string;
  invoiceNumber: string | null;
  razorpayPaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface WorkspaceSettingsViewProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    planId: string;
  };
  currentPlan: PlanLimits;
  role: string;
  activeSubscription?: ActiveSubscriptionInfo | null;
  catalogPlans?: CatalogPlan[];
  transactions?: PaymentTransactionItem[];
  gatewayStatus?: {
    isConfigured: boolean;
    isTestMode: boolean;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

function loadRazorpayCheckoutScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function WorkspaceSettingsView({
  workspace,
  currentPlan,
  role,
  activeSubscription = null,
  catalogPlans = [],
  transactions = [],
  gatewayStatus = { isConfigured: false, isTestMode: true },
}: WorkspaceSettingsViewProps) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [checkingOutPlan, setCheckingOutPlan] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        showToast("success", "Workspace renamed successfully.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Failed to rename workspace.");
      }
    } catch {
      showToast("error", "Network error while renaming workspace.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleStartCheckout = async (planCode: string) => {
    if (planCode === "free") {
      showToast(
        "error",
        "To downgrade to Free, cancel your active paid subscription using the Cancel button below."
      );
      return;
    }

    setCheckingOutPlan(planCode);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode, billingInterval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Unable to start Razorpay checkout.");
        return;
      }

      const loaded = await loadRazorpayCheckoutScript();
      if (!loaded || !window.Razorpay) {
        showToast("error", "Unable to load Razorpay Checkout SDK. Please check your connection.");
        return;
      }

      const rz = new window.Razorpay({
        key: data.razorpayKeyId,
        subscription_id: data.razorpaySubscriptionId,
        name: "PostPulse SaaS",
        description: `${data.planName} (${billingInterval === "ANNUAL" ? "Annual" : "Monthly"})`,
        prefill: data.prefill,
        theme: { color: "#4f46e5" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok && verifyData.success) {
            showToast("success", `Payment verified! Your ${data.planName} subscription is now active.`);
            router.refresh();
          } else {
            showToast(
              "error",
              verifyData.error || "Payment verification pending. Please check invoice history."
            );
          }
        },
      });
      rz.open();
    } catch {
      showToast("error", "Network error initiating Razorpay checkout.");
    } finally {
      setCheckingOutPlan(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (
      !confirm(
        "Cancel your paid subscription at the end of the current billing period? You will keep full access until the renewal date."
      )
    ) {
      return;
    }

    setIsCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelImmediately: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("success", data.message || "Subscription scheduled for cancellation.");
        router.refresh();
      } else {
        showToast("error", data.error || "Failed to cancel subscription.");
      }
    } catch {
      showToast("error", "Network error while cancelling subscription.");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (
      !confirm(
        `Are you absolutely sure you want to delete "${workspace.name}"? This action cannot be undone.`
      )
    )
      return;

    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/app");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast("error", data.error || "Failed to delete workspace.");
      }
    } catch {
      showToast("error", "Network error deleting workspace.");
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8 pb-24 md:pb-12">
      {toast && (
        <div
          className={`fixed top-20 right-4 sm:right-6 z-50 max-w-md p-3.5 rounded-xl shadow-xl text-xs font-semibold text-white animate-fade-in ${
            toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* General Settings */}
      <div className="p-5 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <Building2 className="w-5 h-5 text-indigo-500" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              General Settings
            </h3>
            <p className="text-xs text-zinc-500">
              Manage workspace identity and custom URL slug.
            </p>
          </div>
        </div>

        <form onSubmit={handleUpdateName} className="space-y-4 max-w-md pt-2">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Workspace Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Workspace URL Slug
            </label>
            <input
              type="text"
              disabled
              value={workspace.slug}
              className="w-full px-3 py-2 text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-500 cursor-not-allowed"
            />
          </div>

          <button
            type="submit"
            disabled={isSavingName || name === workspace.name}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
          >
            {isSavingName ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Team Members & Invitations */}
      <TeamManagementCard workspaceId={workspace.id} currentRole={role} />

      {/* Subscription & Razorpay Billing Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>Account Subscription & Razorpay Billing</span>
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              One account-level subscription covers all workspaces you own up to your plan&apos;s workspace limit.
            </p>
          </div>

          {/* Monthly / Annual Billing Toggle */}
          <div className="inline-flex items-center p-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 self-start">
            <button
              type="button"
              onClick={() => setBillingInterval("MONTHLY")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                billingInterval === "MONTHLY"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("ANNUAL")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                billingInterval === "ANNUAL"
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              }`}
            >
              <span>Annual</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                2 Months Free
              </span>
            </button>
          </div>
        </div>

        {/* Active Entitlement Summary */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                Current Plan: {currentPlan.name}
              </span>
              {activeSubscription?.source === "COMPLIMENTARY" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  <Gift className="w-3 h-3" /> Complimentary Access
                </span>
              ) : activeSubscription?.source === "PAID" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" /> Verified Razorpay ({activeSubscription.status})
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  Free Tier
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              Limits: {currentPlan.maxWorkspaces} workspace(s) • {currentPlan.maxSocialAccounts} social accounts • {currentPlan.maxStorageMb} MB storage • {currentPlan.maxTeamMembers} team seat(s).
              {activeSubscription?.currentPeriodEnd && !activeSubscription.isIndefinite && (
                <>
                  {" "}
                  • {activeSubscription.cancelAtPeriodEnd ? "Ends on " : "Renews/Expires on "}
                  {new Date(activeSubscription.currentPeriodEnd).toLocaleDateString()}.
                </>
              )}
              {activeSubscription?.isIndefinite && " • Indefinite complimentary entitlement."}
            </p>
          </div>

          {activeSubscription?.source === "PAID" &&
            activeSubscription.status === "ACTIVE" &&
            !activeSubscription.cancelAtPeriodEnd && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelSubscription}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-900 shrink-0 self-start sm:self-auto"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{isCancelling ? "Cancelling..." : "Cancel Subscription"}</span>
              </button>
            )}
        </div>

        {/* Gateway Status Notice */}
        {!gatewayStatus.isConfigured && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
            <CreditCard className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-semibold">Razorpay Payment Gateway Awaiting API Keys</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Checkout & webhook signature verification are fully implemented. Paid plan upgrades require valid Razorpay credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and Razorpay Plan IDs) — direct unverified free upgrades are disabled for security.
              </p>
            </div>
          </div>
        )}

        {/* Plan Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {catalogPlans.map((plan) => {
            const isCurrent = plan.code === currentPlan.code;
            const price =
              billingInterval === "ANNUAL" ? plan.priceAnnualInr : plan.priceMonthlyInr;

            return (
              <div
                key={plan.code}
                className={`p-5 rounded-xl border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-indigo-600 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-1 ring-indigo-600"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                      {plan.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-white">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs text-zinc-400">
                      /{billingInterval === "ANNUAL" ? "year" : "month"}
                    </span>
                  </div>

                  <ul className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-[11px]">
                        <Check className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || checkingOutPlan === plan.code || plan.code === "free"}
                  onClick={() => handleStartCheckout(plan.code)}
                  className={`w-full mt-5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isCurrent || plan.code === "free"
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  }`}
                >
                  {isCurrent
                    ? "Current Plan"
                    : plan.code === "free"
                      ? "Free Default Tier"
                      : checkingOutPlan === plan.code
                        ? "Starting Razorpay..."
                        : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoice & Transaction History */}
      <div className="p-5 sm:p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Invoice & Payment History
          </h3>
        </div>

        {transactions.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-500">
            No verified payment transactions recorded yet. Complimentary grants do not generate payment invoices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 uppercase">
                <tr>
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Razorpay Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-2.5 pr-4 font-mono text-[11px] text-zinc-900 dark:text-white">
                      {tx.invoiceNumber || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-400">
                      {new Date(tx.paidAt || tx.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 uppercase font-medium text-zinc-900 dark:text-white">
                      {tx.planCode} ({tx.billingInterval})
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-zinc-900 dark:text-white">
                      ₹{(tx.amountPaise / 100).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          tx.status === "CAPTURED"
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : tx.status === "FAILED"
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                              : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-[10px] text-zinc-500">
                      {tx.razorpayPaymentId || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone: Delete Workspace */}
      {role === "OWNER" && (
        <div className="p-6 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Danger Zone</span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-lg">
            Deleting this workspace permanently removes all associated social media connections, scheduled posts, media assets, and analytics.
          </p>
          <button
            type="button"
            onClick={handleDeleteWorkspace}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Workspace</span>
          </button>
        </div>
      )}
    </div>
  );
}
