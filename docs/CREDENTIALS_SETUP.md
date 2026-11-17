# PostPulse — Third-Party API & Credentials Setup Guide

This guide explains how to obtain and configure real production credentials for **Google Business Profile / YouTube**, **Meta (Facebook & Instagram)**, **LinkedIn**, **Razorpay**, and **Resend** when you are ready to switch from **Sandbox Mode** to **Live Mode**.

> **Important Security Rule:** Never paste real API secrets into Git or frontend code. Configure all values in **Netlify Site Settings → Environment Variables** (with **Functions** scope enabled) and redeploy.

---

## 1. Google Cloud (Google Business Profile & YouTube)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (`PostPulse Production`).
2. Enable the following official APIs under **APIs & Services → Library**:
   - **My Business Account Management API**
   - **My Business Business Information API**
   - **Google Business Profile Performance API**
   - **YouTube Data API v3**
3. Configure **OAuth Consent Screen** (External, add your privacy policy URL and authorized domain `netlify.app` or your custom domain).
4. Under **Credentials → Create Credentials → OAuth Client ID (Web Application)**, add the Authorized Redirect URI:
   ```text
   https://postpulse-saas.netlify.app/api/auth/callback/google
   ```
5. Request Google Business Profile API access (required by Google for GBP production quota) via the [GBP API Access Request Form](https://developers.google.com/my-business/content/prereqs).
6. Set in Netlify Environment Variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/google`

---

## 2. Meta Developers (Facebook Pages & Instagram Professional)

1. Open [Meta for Developers](https://developers.facebook.com/) → **Create App → Business**.
2. Add **Facebook Login for Business** and **Instagram Graph API** products.
3. Under **Facebook Login → Settings → Valid OAuth Redirect URIs**, add:
   ```text
   https://postpulse-saas.netlify.app/api/auth/callback/meta
   ```
4. Required permissions (submit for **App Review** before opening to public users):
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
5. Complete **Business Verification** in Meta Business Suite so public users can authorize their pages.
6. Set in Netlify Environment Variables:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/meta`

---

## 3. LinkedIn Developers (Profile & Organization Pages)

1. Open [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) → **Create App** linked to your Company Page.
2. Under **Products**, enable:
   - **Sign In with LinkedIn using OpenID Connect** (`openid`, `profile`, `email`)
   - **Share on LinkedIn** (`w_member_social`)
   - **Community Management API** (optional for Organization Pages: `r_organization_social`, `w_organization_social`, `rw_organization_admin` — then set `LINKEDIN_ENABLE_ORG_SCOPES=true`).
3. Under **Auth → Authorized redirect URLs**, add:
   ```text
   https://postpulse-saas.netlify.app/api/auth/callback/linkedin
   ```
4. Set in Netlify Environment Variables:
   - `LINKEDIN_CLIENT_ID`
   - `LINKEDIN_CLIENT_SECRET`
   - `LINKEDIN_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/linkedin`

---

## 4. Switching from Sandbox Mode to Live Mode

Once credentials above are saved in Netlify:
1. Set `MOCK_SOCIAL_PROVIDERS=false`.
2. Trigger a production deploy.
3. Verify the **Social Accounts** page badge changes from **Sandbox Mode** to **Live OAuth Vault Active**.
4. Connect one test account per platform and click the **Verify** icon to confirm live token validation before launching publicly.

---

## 5. Razorpay Billing (Phase 5)

1. Open [Razorpay Dashboard](https://dashboard.razorpay.com/) (start in **Test Mode**, then switch to **Live Mode** after KYC).
2. Generate API keys under **Account & Settings → API Keys**:
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID` & `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
3. Create 4 Subscription Plans under **Subscriptions → Plans** (Pro Monthly ₹799, Pro Annual ₹7,990, Agency Monthly ₹2,999, Agency Annual ₹29,990) and set their `plan_...` IDs in `RAZORPAY_PLAN_*`.
4. Under **Developers → Webhooks**, add:
   - URL: `https://postpulse-saas.netlify.app/api/webhooks/razorpay`
   - Events: `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `payment.captured`, `payment.failed`, `refund.processed`
   - Copy the Webhook Secret into `RAZORPAY_WEBHOOK_SECRET`.

---

## 6. Resend Transactional Emails (Optional until ready)

1. Open [Resend](https://resend.com/) (Free tier: 3,000 emails/month), verify your sending domain, and create an API key.
2. Set `RESEND_API_KEY` and `EMAIL_FROM` in Netlify Environment Variables.
