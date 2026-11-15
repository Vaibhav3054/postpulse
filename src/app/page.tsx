import Link from "next/link";
import {
  Sparkles,
  CalendarDays,
  ShieldCheck,
  Zap,
  ArrowRight,
  Layers,
  HardDrive,
  Share2,
  CheckCircle2,
  PenSquare,
  Users,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-zinc-800/80 px-6 flex items-center justify-between max-w-7xl mx-auto w-full sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
            P
          </div>
          <span className="font-bold text-lg tracking-tight text-white">PostPulse</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-all"
          >
            <span>Start Free</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-20 flex flex-col items-center text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-xs font-medium animate-fade-in">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Unified Social Media Management</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] max-w-4xl">
          Publish once. <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Reach everywhere on schedule.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          The clean, reliable command center for creators, brands, and agencies. 
          Compose, customize, and schedule content across Instagram, Facebook, YouTube, and LinkedIn using official APIs only.
        </p>

        {/* Hero Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-7 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-3 text-sm font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <span>Sign In to Dashboard</span>
          </Link>
        </div>

        {/* Supported Channels Strip */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-400">
          <span className="text-zinc-500 mr-1">Official integrations for:</span>
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">📸 Instagram Reels & Feed</span>
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">📘 Facebook Pages</span>
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">▶️ YouTube Videos & Shorts</span>
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">💼 LinkedIn Posts</span>
        </div>

        {/* Core Value Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-12 text-left w-full">
          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">
              Multi-Tenant Workspaces
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Organize multiple clients or side brands into strictly isolated workspaces with role-based member permissions and encrypted token vaults.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">
              Official APIs Only
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Zero brittle web scraping, bot cookies, or account ban risks. Direct official OAuth connections with Meta Graph, Google YouTube, and LinkedIn.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm space-y-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-sm text-white">
              Visual Content Calendar
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Drag-and-drop posts across dates to instantly reschedule. Preview scheduled content, target channels, and delivery statuses at a glance.
            </p>
          </div>
        </div>

        {/* Transparent Plans Comparison */}
        <div className="w-full pt-16 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Start completely free and scale as your content schedule grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-left">
            {/* Free Plan */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Free</div>
                  <div className="text-3xl font-extrabold text-white mt-1">$0 <span className="text-xs font-normal text-zinc-500">/ month</span></div>
                  <p className="text-xs text-zinc-400 mt-1">Perfect for solo creators getting started.</p>
                </div>
                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Up to 3 Social Channels</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 30 Scheduled Posts / month</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 500 MB Media Storage</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Live Social Feed Mockups</div>
                </div>
              </div>
              <Link
                href="/signup"
                className="w-full py-2.5 px-4 text-xs font-semibold text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="p-6 rounded-2xl border border-indigo-500/50 bg-indigo-950/20 flex flex-col justify-between space-y-6 relative shadow-lg shadow-indigo-500/10">
              <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Popular
              </div>
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Pro Creator</div>
                  <div className="text-3xl font-extrabold text-white mt-1">$19 <span className="text-xs font-normal text-zinc-500">/ month</span></div>
                  <p className="text-xs text-zinc-400 mt-1">For active creators and fast-growing brands.</p>
                </div>
                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Up to 10 Social Channels</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Unlimited Scheduled Posts</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> 5 GB High-Speed Media Storage</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Team Collaboration (3 seats)</div>
                </div>
              </div>
              <Link
                href="/signup"
                className="w-full py-2.5 px-4 text-xs font-semibold text-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Agency Plan */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Agency</div>
                  <div className="text-3xl font-extrabold text-white mt-1">$49 <span className="text-xs font-normal text-zinc-500">/ month</span></div>
                  <p className="text-xs text-zinc-400 mt-1">For digital agencies managing multiple clients.</p>
                </div>
                <div className="space-y-2 text-xs text-zinc-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Unlimited Workspaces</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Up to 50 Social Channels</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 25 GB Cloud Asset Vault</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Advanced Audit Logs & Analytics</div>
                </div>
              </div>
              <Link
                href="/signup"
                className="w-full py-2.5 px-4 text-xs font-semibold text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
              >
                Contact for Agency
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-8 px-6 text-center text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
            P
          </div>
          <span>PostPulse © 2026. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-zinc-400">
          <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
          <Link href="/signup" className="hover:text-white transition-colors">Register</Link>
          <span>Official APIs • Zero Web Scraping</span>
        </div>
      </footer>
    </div>
  );
}
