import type { Metadata } from "next";
import { LegalPageShell, SUPPORT_EMAIL } from "@/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — PostPulse",
  description:
    "Subscription cancellation, billing cycle, and refund eligibility policy for PostPulse.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPageShell
      title="Cancellation & Refund Policy"
      subtitle="Clear, transparent subscription cancellation and refund rules for PostPulse."
      lastUpdated="November 2026"
      activePath="/refund-policy"
    >
      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">1. Try Free Before Upgrading</h2>
        <p>
          PostPulse provides a permanently free <strong className="text-white">Free Starter (₹0)</strong>{" "}
          plan so you can test the workspace, composer, media storage, and integrations before
          upgrading to a paid <strong className="text-white">Pro</strong> (₹799/mo or ₹7,990/yr) or{" "}
          <strong className="text-white">Agency</strong> (₹2,999/mo or ₹29,990/yr) subscription.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">2. Subscription Cancellation</h2>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            You may cancel your paid subscription at any time directly inside PostPulse under{" "}
            <strong className="text-white">Workspace Settings → Subscription &amp; Billing</strong>.
          </li>
          <li>
            When you cancel, automatic renewal stops immediately and you will not be billed for the
            next billing cycle.
          </li>
          <li>
            Your paid features and quotas remain active until the end of your current paid billing
            period, after which your account transitions automatically to the Free plan (your
            workspaces and historical posts remain intact).
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">3. Refund Eligibility</h2>
        <p>
          Because PostPulse provides instant digital SaaS access and cloud storage allocation upon
          payment, subscription charges are generally non-refundable once the billing cycle starts.
          However, we gladly issue full refunds in the following situations when requested within{" "}
          <strong className="text-white">7 calendar days</strong> of the charge:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            <strong className="text-white">Duplicate or Accidental Charges:</strong> If you were
            billed twice for the same billing period or experienced a payment gateway error.
          </li>
          <li>
            <strong className="text-white">Technical Non-Delivery:</strong> If a verified platform
            defect prevented your paid subscription upgrade from activating and our support team
            could not resolve it within 48 hours.
          </li>
          <li>
            <strong className="text-white">First-Time Annual Plan Review:</strong> For first-time
            annual subscribers requesting cancellation within 7 days of initial purchase with
            minimal usage.
          </li>
        </ul>
        <p className="text-zinc-400">
          Partial-month prorated refunds for mid-cycle cancellations and refunds for accounts
          suspended due to Terms of Service violations are not eligible.
        </p>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">4. How to Request a Refund &amp; Processing Time</h2>
        <p>
          To request a refund, email{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=PostPulse%20Refund%20Request`}
            className="text-indigo-400 hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{" "}
          with your registered account email, Razorpay Payment/Subscription ID (visible in{" "}
          <em>Settings → Billing → Payment History</em>), and the reason for your request.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>We review and respond to all refund requests within <strong className="text-white">2 business days</strong>.</li>
          <li>
            Approved refunds are initiated via <strong className="text-white">Razorpay</strong>{" "}
            directly back to your original payment method (UPI, card, or net banking) and typically
            reflect within <strong className="text-white">5–7 business days</strong>, depending on
            your bank.
          </li>
        </ul>
      </section>

      <section className="space-y-2.5">
        <h2 className="text-base font-bold text-white">5. Support &amp; Grievance Contact</h2>
        <p>
          <strong className="text-white">PostPulse Billing Support</strong>
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
