import type { Metadata } from "next";
import { LegalPageShell, SUPPORT_EMAIL } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — PostPulse",
  description:
    "How PostPulse collects, protects, encrypts, and uses your account and connected social media data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      subtitle="How PostPulse collects, uses, encrypts, and protects your personal and connected social platform information."
      lastUpdated="November 2026"
      activePath="/privacy"
    >
      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">1. Who We Are</h2>
        <p>
          <strong className="text-white">PostPulse</strong> (
          <span className="text-zinc-200">https://postpulse-saas.netlify.app</span>) is a
          multi-platform social media scheduling, publishing, and account management SaaS platform.
          For privacy questions or data requests, contact us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">2. Information We Collect</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            <strong className="text-white">Account &amp; Workspace Data:</strong> Your name, email
            address, securely hashed password (bcrypt), workspace names, team member roles, and
            pending invitations.
          </li>
          <li>
            <strong className="text-white">Connected Social Media Accounts:</strong> When you
            explicitly authorize a social channel via official OAuth 2.0 (LinkedIn, YouTube, Google
            Business Profile, Facebook Pages, or Instagram Professional), we store the authorized
            account identifier, display name, profile avatar URL, granted scopes, and encrypted
            OAuth access/refresh tokens.
          </li>
          <li>
            <strong className="text-white">Content &amp; Media Assets:</strong> Post captions,
            scheduling timestamps, uploaded images/videos stored in Supabase Cloud Storage, and
            publishing status/attempt logs.
          </li>
          <li>
            <strong className="text-white">Billing &amp; Subscription Metadata:</strong> Plan tier,
            billing cycle, subscription status, and Razorpay payment/subscription references. We{" "}
            <strong className="text-white">never</strong> store raw credit/debit card numbers, CVV,
            or UPI PINs — all payment instruments are processed directly by Razorpay.
          </li>
          <li>
            <strong className="text-white">Security &amp; Operational Logs:</strong> IP addresses
            for rate limiting, password recovery, and workspace audit trails to protect your
            account from unauthorized access.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">3. How We Use Your Data</h2>
        <p>We use your information strictly to provide and improve PostPulse:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>Authenticate your sessions and enforce strict workspace tenant isolation.</li>
          <li>
            Publish scheduled posts, upload media, and sync account details exclusively to the
            social channels you explicitly connect and select.
          </li>
          <li>
            Send transactional emails (password reset links, team invitations, and failed-publish
            alerts) via Resend.
          </li>
          <li>Manage subscription entitlements, invoices, and customer support requests.</li>
        </ul>
        <p className="text-zinc-400">
          We <strong className="text-white">never sell</strong> your personal data or social media
          data to third parties, advertisers, or data brokers, and we never use your connected
          social account data to train AI or machine learning models.
        </p>
      </section>

      <section className="space-y-2.5 p-5 rounded-xl bg-zinc-900/80 border border-zinc-800">
        <h2 className="text-base font-bold text-white">
          4. Google API Services User Data Policy &amp; YouTube Disclosure
        </h2>
        <p>
          PostPulse&apos;s use and transfer to any other app of information received from Google
          APIs adheres strictly to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the <strong className="text-white">Limited Use requirements</strong>.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            When connecting YouTube, PostPulse uses YouTube API Services solely to view your
            authorized channel metadata and upload/publish videos that you create or schedule in
            PostPulse. By using YouTube features in PostPulse, you also agree to the{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              YouTube Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Google Privacy Policy
            </a>
            .
          </li>
          <li>
            When connecting Google Business Profile, PostPulse accesses only the business profile
            details, local posts, photos, and customer reviews you authorize to manage inside your
            workspace.
          </li>
          <li>
            You may revoke PostPulse&apos;s access to your Google account at any time inside
            PostPulse (<em>Social Accounts → Disconnect</em>) or directly via your{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:underline"
            >
              Google Security Settings
            </a>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">
          5. LinkedIn &amp; Meta (Facebook / Instagram) Integrations
        </h2>
        <p>
          PostPulse connects to LinkedIn and Meta platforms exclusively through their official
          OAuth 2.0 APIs. We never ask for your social media passwords and perform zero web
          scraping. You may disconnect any LinkedIn, Facebook, or Instagram account at any time
          from your workspace&apos;s <em>Social Accounts</em> page, which immediately stops
          automated publishing and removes active access inside PostPulse.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">6. Security &amp; Data Protection</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>All traffic is encrypted over HTTPS/TLS with strict security headers (HSTS).</li>
          <li>
            OAuth access and refresh tokens are encrypted at rest using{" "}
            <strong className="text-white">AES-256-GCM</strong> and are never exposed to client
            browsers.
          </li>
          <li>
            Session cookies are HTTP-only, signed, and invalidated immediately upon password reset.
          </li>
          <li>
            Database infrastructure and object storage are hosted on Supabase (PostgreSQL &amp;
            Cloud Storage) with strict workspace-level authorization checks on every API request.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">
          7. Data Retention &amp; Data Deletion Instructions
        </h2>
        <p>
          We retain your account, workspace posts, and connected tokens only while your account is
          active. You can disconnect individual social accounts or delete media/posts at any time
          directly in the dashboard.
        </p>
        <p>
          To request complete deletion of your PostPulse account and all associated personal data
          (including any cached LinkedIn, Google, or Meta data), email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=PostPulse%20Data%20Deletion%20Request`}
            className="text-indigo-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          from your registered email address with the subject{" "}
          <code className="px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-200 text-xs">
            PostPulse Data Deletion Request
          </code>
          . We verify and permanently delete all user data within <strong className="text-white">7 business days</strong>{" "}
          (excluding billing invoices required to be retained by applicable tax/accounting law).
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">8. Contact Us</h2>
        <p>
          <strong className="text-white">PostPulse Support</strong>
          <br />
          Email:{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-indigo-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
        </p>
      </section>
    </LegalPageShell>
  );
}
