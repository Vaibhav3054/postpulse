"use client";

import { ExternalLink, Building2, Users, Globe, Info } from "lucide-react";

interface LinkedInAccountItem {
  id: string;
  platformAccountId: string;
  platformDisplayName?: string | null;
  platformUsername?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, unknown>;
}

interface LinkedInOrganizationViewProps {
  account: LinkedInAccountItem;
}

export function LinkedInOrganizationView({ account }: LinkedInOrganizationViewProps) {
  const meta = (account.metadata as Record<string, unknown>) || {};
  const industry = (meta.industry as string) || "Technology, Information and Internet";
  const staffCount = (meta.staffCount as string) || "11-50 employees";
  const tagline =
    (meta.tagline as string) ||
    "Empowering modern creators and agencies with next-generation multi-platform scheduling pipelines.";

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-16 h-16 rounded-xl bg-[#0A66C2] text-white font-extrabold text-2xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              {account.avatarUrl ? (
                <img src={account.avatarUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                "in"
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                  {account.platformDisplayName || "LinkedIn Company Page"}
                </h3>
                <span className="whitespace-nowrap shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20 dark:text-blue-300 border border-[#0A66C2]/20">
                  Organization
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {industry} • {staffCount}
              </p>
            </div>
          </div>

          <a
            href={`https://www.linkedin.com/company/${account.platformAccountId}/admin/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl bg-[#0A66C2] hover:bg-[#084e96] text-white shadow-sm transition-all w-full sm:w-auto shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Manage on LinkedIn Page Admin</span>
          </a>
        </div>

        {/* Overview Box */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-1">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Company Tagline & Mission</div>
          <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed">{tagline}</p>
        </div>

        {/* Official Policy Alert */}
        <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
            <span className="font-bold">Official LinkedIn Developer Policy:</span> Updates to organization legal entity profiles require enterprise-level `rw_organization_admin` approval from LinkedIn's partner review board. Standard verified integrations publish company updates directly to feeds and link administrators directly to LinkedIn's native management tools.
          </div>
        </div>
      </div>
    </div>
  );
}
