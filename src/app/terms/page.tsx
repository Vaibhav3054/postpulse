import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell, SUPPORT_EMAIL } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — PostPulse",
  description:
    "Terms and conditions governing use of the PostPulse SaaS platform.",
};

export default function TermsOfServicePage() {
  return (
    <LegalPageShell
      title="Terms of Service"
      subtitle="The terms governing your access to and use of PostPulse."
      lastUpdated="November 2026"
      activePath="/terms"
    >
      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">1. Acceptance of Terms</h2>
        <p>
          By creating an account, accessing, or using <strong className="text-white">PostPulse</strong>,
          you agree to be bound by these Terms of Service and our{" "}
          <Link href="/privacy" className="text-indigo-400 hover:underline">
            Privacy Policy
          </Link>
          . If you are using PostPulse on behalf of a business or agency, you represent that you
          have authority to bind that organization to these terms.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">2. Description of Service</h2>
        <p>
          PostPulse provides cloud-based multi-platform social media content creation, media asset
          storage, automated 24/7 post scheduling, team collaboration, and official API account
          management for supported third-party platforms (including LinkedIn, YouTube, Google
          Business Profile, Facebook Pages, and Instagram Professional, as enabled).
        </p>
        <p className="text-zinc-400">
          Certain integrations may be marked as &ldquo;Coming Soon&rdquo; while undergoing official
          platform API certification and will become available once certified.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">3. Accounts, Workspaces &amp; Team Security</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>You must provide accurate registration information and maintain a strong password.</li>
          <li>
            You are responsible for all activity occurring within your workspaces and by team
            members you invite.
          </li>
          <li>
            You must promptly notify us at{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-indigo-400 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            if you suspect unauthorized access to your account.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">4. Acceptable Use &amp; Platform Compliance</h2>
        <p>You retain ownership of all content and media you upload to PostPulse. You agree NOT to:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            Publish spam, illegal content, hate speech, malware, copyrighted material without
            authorization, or deceptive content.
          </li>
          <li>
            Violate the terms of service or developer policies of LinkedIn, Google/YouTube, or
            Meta.
          </li>
          <li>
            Attempt to bypass workspace isolation, rate limits, subscription quotas, or security
            controls.
          </li>
        </ul>
        <p>
          PostPulse reserves the right to suspend or terminate accounts that violate these terms
          or abuse platform APIs.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">5. Plans, Subscriptions &amp; Billing</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            <strong className="text-white">Free Plan (₹0):</strong> Includes core scheduling and
            workspace quotas at no charge.
          </li>
          <li>
            <strong className="text-white">Paid Subscriptions (Pro &amp; Agency):</strong> Billed
            in Indian Rupees (INR) on a recurring monthly or annual basis via{" "}
            <strong className="text-white">Razorpay</strong> (Pro: ₹799/month or ₹7,990/year;
            Agency: ₹2,999/month or ₹29,990/year, subject to applicable taxes and plan updates
            communicated in advance).
          </li>
          <li>
            <strong className="text-white">Cancellation &amp; Refunds:</strong> You may cancel your
            subscription at any time from Workspace Settings → Billing. Please review our{" "}
            <Link href="/refund-policy" className="text-indigo-400 hover:underline">
              Cancellation &amp; Refund Policy
            </Link>{" "}
            for full details.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">6. Third-Party APIs &amp; Availability</h2>
        <p>
          PostPulse relies on official third-party social media APIs (LinkedIn, Google, Meta).
          While we operate automated retry and token-refresh systems to maximize reliability,
          PostPulse is not responsible for publishing delays, API rate limits, outages, or account
          restrictions imposed directly by third-party social networks.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">7. Limitation of Liability</h2>
        <p>
          PostPulse is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To
          the maximum extent permitted by law, PostPulse shall not be liable for any indirect,
          incidental, consequential, or punitive damages, or loss of profits or data. Our total
          aggregate liability for any claim relating to the service shall not exceed the total fees
          paid by you to PostPulse in the three (3) months preceding the claim.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">8. Governing Law &amp; Contact</h2>
        <p>
          These Terms are governed by the laws of India. Any disputes shall be subject to the
          jurisdiction of competent courts in India. Questions may be directed to{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
