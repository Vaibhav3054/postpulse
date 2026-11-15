"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Sparkles,
  Check,
  AlertTriangle,
  Trash2,
  Users,
  Shield,
  CreditCard,
} from "lucide-react";
import { SUBSCRIPTION_PLANS, PlanLimits } from "@/lib/quota";

interface WorkspaceSettingsViewProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    planId: string;
  };
  currentPlan: PlanLimits;
  role: string;
}

export function WorkspaceSettingsView({
  workspace,
  currentPlan,
  role,
}: WorkspaceSettingsViewProps) {
  const router = useRouter();
  const [name, setName] = useState(workspace.name);
  const [isSavingName, setIsSavingName] = useState(false);
  const [activePlanCode, setActivePlanCode] = useState(workspace.planId);
  const [isSwitchingPlan, setIsSwitchingPlan] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
        setToastMessage("Workspace renamed successfully.");
        setTimeout(() => setToastMessage(null), 3000);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSwitchPlan = async (planCode: string) => {
    setIsSwitchingPlan(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          planCode,
        }),
      });
      if (res.ok) {
        setActivePlanCode(planCode);
        setToastMessage(`Plan upgraded to ${SUBSCRIPTION_PLANS[planCode]?.name || planCode}!`);
        setTimeout(() => setToastMessage(null), 4000);
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwitchingPlan(false);
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3 bg-emerald-600 text-white rounded-xl shadow-xl text-xs font-semibold animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* General Settings */}
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
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

      {/* Subscription Plans & Limits Architecture */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Subscription Plans & Limits</span>
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Database-driven quota limits. Select any tier below to simulate plan upgrades instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
            const isCurrent = plan.code === activePlanCode;

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
                      ${plan.priceMonthly}
                    </span>
                    <span className="text-xs text-zinc-400">/month</span>
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
                  disabled={isCurrent || isSwitchingPlan}
                  onClick={() => handleSwitchPlan(plan.code)}
                  className={`w-full mt-5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    isCurrent
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-default"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  }`}
                >
                  {isCurrent ? "Current Plan" : "Switch to Tier"}
                </button>
              </div>
            );
          })}
        </div>
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
