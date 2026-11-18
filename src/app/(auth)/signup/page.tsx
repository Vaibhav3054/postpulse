"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Mail,
  User,
  Building2,
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const PASSWORD_RULES = [
  { id: "len", label: "8+ chars", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "Uppercase (A-Z)", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Lowercase (a-z)", test: (p: string) => /[a-z]/.test(p) },
  { id: "num", label: "Number (0-9)", test: (p: string) => /[0-9]/.test(p) },
  { id: "sym", label: "Symbol (!@#$%)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedEmail = params.get("email");
    if (invitedEmail) {
      setEmail(invitedEmail.trim());
    }
  }, []);

  const passedRulesCount = PASSWORD_RULES.filter((r) => r.test(password)).length;
  const isPasswordStrong = passedRulesCount === PASSWORD_RULES.length;
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordStrong) {
      setError(
        "Please create a strong password with at least 8 characters, an uppercase letter, a lowercase letter, a number, and a symbol."
      );
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter the same password.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          workspaceName: workspaceName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Signup failed");
      }

      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get("next");
      const safeNext =
        nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
          ? nextPath
          : null;

      // Smoothly navigate to invited URL or new workspace dashboard
      if (safeNext) {
        router.push(safeNext);
      } else if (data.workspaceSlug) {
        router.push(`/app/${data.workspaceSlug}/dashboard`);
      } else {
        router.push("/app");
      }
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* Left Column: Value Proposition & Social Proof */}
        <div className="lg:col-span-5 space-y-6 text-left">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base tracking-tight shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              P
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">
              PostPulse
            </span>
          </Link>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Platform Publishing Suite</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
              Publish everywhere. <br />
              <span className="text-indigo-400">Manage from one place.</span>
            </h1>
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
              Join creators, marketers, and agencies scheduling content across Instagram, Facebook, YouTube, and LinkedIn.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              "Multi-tenant workspaces with isolated tokens & team members",
              "Unified composer with real-time live social previews",
              "Drag-and-drop visual monthly & weekly content calendar",
              "100% Free Tier with zero credit card required",
            ].map((feature, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-zinc-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-400 space-y-1">
            <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Strict Official APIs</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Zero brittle web scraping or account-compromising hacks. All tokens stored with AES-256-GCM encryption.
            </p>
          </div>
        </div>

        {/* Right Column: Signup Form Card */}
        <div className="lg:col-span-7">
          <div className="bg-zinc-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 border border-zinc-800 rounded-2xl shadow-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">
                Create your free account
              </h2>
              <p className="mt-1 text-xs text-zinc-400">
                No credit card required. Start scheduling across connected channels in seconds.
              </p>
            </div>

            {error && (
              <div className="p-3 text-xs bg-rose-950/60 border border-rose-800/80 text-rose-300 rounded-xl flex items-center gap-2 animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-white placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Initial Workspace / Brand
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Acme Studio (Optional)"
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-white placeholder:text-zinc-600 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-3 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-white placeholder:text-zinc-600 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Password
                  </label>
                  {password.length > 0 && (
                    <span
                      className={`text-[10px] font-semibold ${
                        passedRulesCount <= 2
                          ? "text-rose-400"
                          : passedRulesCount <= 4
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {passedRulesCount <= 2
                        ? "Weak"
                        : passedRulesCount <= 4
                          ? "Almost there"
                          : "Strong password"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-10 py-2.5 text-xs bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-white placeholder:text-zinc-600 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Live Password Strength Bar & Checklist */}
                <div className="mt-2.5 space-y-2">
                  <div className="grid grid-cols-5 gap-1">
                    {PASSWORD_RULES.map((rule, idx) => (
                      <div
                        key={rule.id}
                        className={`h-1 rounded-full transition-colors ${
                          idx < passedRulesCount
                            ? passedRulesCount <= 2
                              ? "bg-rose-500"
                              : passedRulesCount <= 4
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                            : "bg-zinc-800"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const ok = rule.test(password);
                      return (
                        <span
                          key={rule.id}
                          className={`inline-flex items-center gap-1 text-[11px] transition-colors ${
                            ok ? "text-emerald-400" : "text-zinc-500"
                          }`}
                        >
                          {ok ? (
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                          ) : (
                            <Circle className="w-3 h-3 shrink-0" />
                          )}
                          <span>{rule.label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Confirm Password
                  </label>
                  {passwordsMatch && (
                    <span className="text-[10px] font-semibold text-emerald-400">
                      Passwords match
                    </span>
                  )}
                  {passwordsMismatch && (
                    <span className="text-[10px] font-semibold text-rose-400">
                      Passwords do not match
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-3 py-2.5 text-xs bg-zinc-950 border rounded-xl focus:outline-none focus:ring-2 text-white placeholder:text-zinc-600 transition-all ${
                      passwordsMismatch
                        ? "border-rose-600 focus:ring-rose-500/40 focus:border-rose-500"
                        : passwordsMatch
                          ? "border-emerald-600/80 focus:ring-emerald-500/40 focus:border-emerald-500"
                          : "border-zinc-800 focus:ring-indigo-500/50 focus:border-indigo-500"
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || passwordsMismatch}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] disabled:opacity-50 shadow-lg shadow-indigo-600/30 transition-all mt-4 cursor-pointer"
              >
                <span>{loading ? "Creating your workspace..." : "Create Account & Workspace"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
                By creating an account, you agree to our{" "}
                <Link href="/terms" className="text-zinc-300 hover:text-white underline underline-offset-2">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-zinc-300 hover:text-white underline underline-offset-2">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>

            <div className="pt-4 border-t border-zinc-800 text-center">
              <p className="text-xs text-zinc-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
