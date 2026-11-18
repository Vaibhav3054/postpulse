import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface LegalPageShellProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  activePath: "/privacy" | "/terms" | "/refund-policy";
  children: React.ReactNode;
}

export function LegalPageShell({
  title,
  subtitle,
  lastUpdated,
  activePath,
  children,
}: LegalPageShellProps) {
  const navLinks = [
    { href: "/privacy" as const, label: "Privacy Policy" },
    { href: "/terms" as const, label: "Terms of Service" },
    { href: "/refund-policy" as const, label: "Refund Policy" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/30">
              P
            </div>
            <div className="leading-tight">
              <div className="font-bold text-base text-white tracking-tight">PostPulse</div>
              <div className="text-[10px] text-zinc-500">by Let It Grow</div>
            </div>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-3 border-b border-zinc-800 pb-6">
          <div className="flex flex-wrap gap-2">
            {navLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  activePath === item.href
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white pt-2">
            {title}
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl">{subtitle}</p>
          <p className="text-xs text-zinc-500">
            Effective &amp; Last Updated: {lastUpdated} · Operated by <strong className="text-zinc-300">Let It Grow</strong>
          </p>
        </div>

        <article className="space-y-7 text-sm text-zinc-300 leading-relaxed">
          {children}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 py-6 px-4 sm:px-6 text-xs text-zinc-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>PostPulse by Let It Grow © 2026. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-5 text-zinc-400">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <Link href="/refund-policy" className="hover:text-white transition-colors">
              Refund Policy
            </Link>
            <a
              href="mailto:vaibhavacharya305@gmail.com"
              className="hover:text-white transition-colors"
            >
              Contact Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
