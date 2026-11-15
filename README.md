# PostPulse — Production Multi-Tenant Social Media SaaS Platform

PostPulse is a modern, production-grade social media management SaaS platform designed for creators, businesses, and digital agencies. Inspired by tools like Buffer and Metricool, PostPulse features an original, minimalist editorial interface, multi-tenant workspace architecture, direct-to-cloud media uploads with zero egress fees, and reliable scheduled publishing across **Instagram**, **Facebook Pages**, **YouTube**, and **LinkedIn** using official APIs exclusively.

---

## Architecture Overview

- **Frontend & API**: Next.js 16 (React 19, Tailwind CSS, Turbopack) with App Router.
- **Database & Multi-Tenancy**: PostgreSQL with Prisma ORM; strict row-level isolation via `workspace_id`.
- **Media Storage**: Cloudflare R2 direct-to-storage presigned PUT URLs via `@aws-sdk/client-s3` (10 GB free, $0 egress bandwidth costs).
- **Background Job Queue & Scheduler**: Standalone Node.js worker daemon with BullMQ and an idempotent 1-minute ticker with row-level locks.
- **Official Social Adapters**: Dual-mode modular provider architecture for Meta Graph API (Instagram & Facebook Pages), Google YouTube Data API v3, and LinkedIn Community Management API.
- **Security & Vault**: AES-256-GCM token encryption at rest. Tokens are decrypted only in backend worker memory.

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default values are pre-configured for instant offline development and testing.

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Start Background Publishing Worker
In a separate terminal:
```bash
npm run worker
```

---

## Pre-Seeded Demo Credentials

For instant local testing without setting up external accounts:
- **Email**: `demo@postpulse.io`
- **Password**: `password123`
*(A 1-click "Autofill" button is available on the sign-in screen)*

---

## Core Features

1. **Multi-Tenant Workspaces**:
   - Create, switch, rename, and manage client workspaces with URL-scoped routes (`/app/[workspaceSlug]/...`).
   - Strict tenant isolation ensures client data is never co-mingled.
2. **Unified Content Composer**:
   - Split-pane layout with live mockup previews for Instagram, Facebook, YouTube, and LinkedIn.
   - Master caption with platform-specific custom overrides and real-time character counters.
   - Direct media upload with drag-and-drop.
3. **Visual Content Calendar**:
   - Month, Week, and Day views displaying rich social post chips.
   - Fluid drag-and-drop rescheduling with instant UTC conversion.
4. **Media Library**:
   - Workspace-isolated asset management with storage quota indicators.
5. **Channel Connection Center**:
   - Official OAuth 2.0 connection management with AES-256-GCM token encryption.
   - Built-in Sandbox/Mock toggle for immediate development testing without Meta/Google review delays.
6. **Subscription Quota Architecture**:
   - Centralized database-driven limits service (`free`, `creator`, `business`, `agency`).
   - In-app tier switcher in settings for rapid testing of higher plan limits.

---

## Production Build & Verification

```bash
npm run build
```
Validates all routes, static prerendering, and TypeScript type checks.
