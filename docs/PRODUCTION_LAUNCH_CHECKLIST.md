# PostPulse — Production Launch Checklist

Use this checklist before merging `feat/saas-launch-phases` into `main` and deploying publicly on Netlify.

---

## 1. Security & Secrets Configuration (Netlify Environment Variables)

Configure all required variables in **Netlify Site Settings → Environment Variables**. Ensure **Functions** scope is enabled for every server-side secret so Scheduled & Background Functions can read them.

- [ ] `NODE_ENV=production`
- [ ] `APP_URL=https://postpulse-saas.netlify.app` (update if moving to a custom domain later)
- [ ] `JWT_SECRET` — minimum 32 chars (64 hex chars via `openssl rand -hex 32`)
- [ ] `ADMIN_JWT_SECRET` — separate 64-hex secret for `/platform-admin` sessions
- [ ] `TOKEN_ENCRYPTION_SECRET` — **exact 64 hex chars** (32 bytes) for AES-256-GCM OAuth token vault
- [ ] `CRON_SECRET` — strong random token shared between Netlify Scheduled Functions and `/api/publishing/dispatch`
- [ ] `SUPERADMIN_EMAILS` — comma-separated list of authorized founder email(s) for `/platform-admin`
- [ ] Verify Netlify **Secrets Scanning** is active (`netlify.toml` keeps it enabled with only public keys omitted)

---

## 2. Database & Backup Readiness (Supabase PostgreSQL)

- [ ] `DATABASE_URL` points to Supabase **Transaction Pooler** (`port 6543`, `?pgbouncer=true`)
- [ ] `DIRECT_URL` points to Supabase **Direct Connection** (`port 5432`) for schema updates
- [ ] Verify **Supabase Daily Backups** (or Point-in-Time Recovery on Pro) are enabled in **Supabase Dashboard → Database → Backups**
- [ ] Run **Supabase Security Advisor** in Dashboard: ensure public anonymous PostgREST API access is disabled or locked down via RLS on `public` tables (PostPulse accesses Postgres exclusively via server-side Prisma over service credentials, never via client-side Supabase anon key)
- [ ] Confirm `npx prisma db push` has been run cleanly against the production database (all Phase 1–8 additive models applied without data loss)

---

## 3. Cloud Storage Readiness (Supabase Storage)

- [ ] `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `STORAGE_BUCKET=postpulse-assets` set in Netlify
- [ ] Bucket `postpulse-assets` exists in Supabase Storage with public read access for published social media assets and service-role-only write/delete
- [ ] Confirm production uploads succeed and write exclusively to Supabase Storage (local disk fallback is disabled in production)

---

## 4. Super Admin Account Promotion

- [ ] Sign up your founder account via `/signup` (or choose existing founder user)
- [ ] Promote the account once from a trusted machine:
  ```bash
  npx tsx --env-file=.env scripts/promote-superadmin.ts founder@yourdomain.com
  ```
- [ ] Add `founder@yourdomain.com` to `SUPERADMIN_EMAILS` in Netlify Environment Variables
- [ ] Verify login at `https://postpulse-saas.netlify.app/platform-admin/login` (separate cookie `postpulse_admin_session`)
- [ ] Confirm normal user sessions cannot access `/platform-admin` (`401` / redirect)

---

## 5. Transactional Email (Resend)

- [ ] Create Resend account and verify sending domain (DKIM/SPF DNS records)
- [ ] Set `RESEND_API_KEY` and `EMAIL_FROM="PostPulse <notifications@yourdomain.com>"` in Netlify
- [ ] Test **Forgot Password** (`/forgot-password`), **Team Invitation** email, and **Failed Publish Alert** email

---

## 6. Payment Gateway Cutover (Razorpay)

See full walkthrough in [`docs/CREDENTIALS_SETUP.md`](./CREDENTIALS_SETUP.md).

- [ ] Create Monthly & Annual plans in Razorpay Dashboard (Test Mode first, then Live Mode):
  - Pro Monthly (`₹799`), Pro Annual (`₹7,990`)
  - Agency Monthly (`₹2,999`), Agency Annual (`₹29,990`)
- [ ] Set `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and the 4 `RAZORPAY_PLAN_*` IDs in Netlify
- [ ] Configure Razorpay Webhook URL: `https://postpulse-saas.netlify.app/api/webhooks/razorpay`
  - Subscribe to: `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`, `payment.captured`, `payment.failed`
- [ ] Complete one end-to-end Razorpay Test Mode checkout & verify:
  - Signature verified via `/api/billing/verify`
  - Webhook recorded once in `WebhookEvent` (idempotent)
  - Workspace limits upgraded automatically
  - Invoice recorded in Settings → Billing and `/platform-admin` → Payments
- [ ] Switch keys & Plan IDs to **Razorpay Live Mode** before public announcement

---

## 7. Real Social OAuth Cutover (Google, Meta, LinkedIn)

See full developer portal setup in [`docs/CREDENTIALS_SETUP.md`](./CREDENTIALS_SETUP.md).

- [ ] **Google Cloud**: Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/google` and complete Google Business Profile API approval
- [ ] **Meta App**: Configure `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/meta` and complete Meta App Review for Facebook Pages & Instagram Content Publishing
- [ ] **LinkedIn App**: Configure `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_OAUTH_REDIRECT_URI=https://postpulse-saas.netlify.app/api/auth/callback/linkedin` (enable `LINKEDIN_ENABLE_ORG_SCOPES=true` after Community Management API approval)
- [ ] Flip `MOCK_SOCIAL_PROVIDERS=false` in Netlify once live credentials are ready
- [ ] Verify one real OAuth connection + one real scheduled post publish per active provider before opening public signups

---

## 8. 24/7 Automated Publishing & Monitoring

- [ ] Confirm Netlify deploy log registers:
  - `netlify/functions/scheduled-publish.mts` (`* * * * *`)
  - `netlify/functions/publish-batch-background.mts` (`background: true`)
- [ ] Optionally set `SENTRY_DSN` and/or `ALERT_WEBHOOK_URL` (Slack/Discord) for instant error alerting
- [ ] Add an uptime monitor (e.g., UptimeRobot / BetterStack) polling `GET https://postpulse-saas.netlify.app/api/health` every 5 minutes (expects HTTP `200` and `"status": "ok"`)

---

## 9. Post-Deploy Smoke Test

- [ ] `GET /api/health` returns `200`, `database.status = "up"`, `storage.configured = true`
- [ ] Response headers include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`
- [ ] New user signup → workspace creation → media upload → scheduled post → calendar/posts pagination → team invite → forgot password flow all succeed cleanly on both desktop and mobile (`390×844`)
- [ ] `/platform-admin` displays live DB KPIs, user/workspace search, and logs an immutable `AdminAuditLog` entry on any action
