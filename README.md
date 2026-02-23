# SYNCY Waitlist

Single-page waitlist built with Vite + React, deployed on Vercel, with secure writes to Supabase.

## What is included

- One landing page matching your waitlist design
- `/api/waitlist` serverless endpoint for inserts
- Live waitlist count from database (no fake baseline)
- Unique email enforcement (case-insensitive)
- Anti-spam protections:
  - hidden honeypot field
  - minimum form fill time check
  - IP-based rate limiting (20/hour)
  - optional Cloudflare Turnstile

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill values.

3. Start full-stack local dev (frontend + `/api/waitlist`):

```bash
npm run dev
```

If you only want frontend static preview without API routes, use:

```bash
npm run dev:vite
```

## Create a new Supabase project

1. Create a brand new project in Supabase.
2. Open SQL Editor and run [schema.sql](/Users/nathaniellee/claude/syncy/syncy-waitlist/supabase/schema.sql).
3. Copy:
- Project URL -> `SUPABASE_URL`
- Service role key -> `SUPABASE_SERVICE_ROLE_KEY`

## Deploy to Vercel

1. Import `/syncy-waitlist` as a new Vercel project.
2. Add env vars from `.env.example` in Vercel Project Settings.
3. Deploy.
4. Add your domain in Vercel and point DNS.

## Owner push and auto redeploy

- Local helper script:
  - `npm run push:owner:main`
  - or `./scripts/push-as-owner.sh main "your commit message"`
- This sets git author to `syncyio534`, commits pending changes, and pushes `main`.
- GitHub workflow: `.github/workflows/vercel-redeploy.yml`
  - triggers on push/schedule/manual dispatch
  - enforces owner commit when non-owner pushes
  - can call Vercel Deploy Hook
- Add this repository secret in GitHub:
  - `VERCEL_DEPLOY_HOOK_WAITLIST`

## Optional: Turnstile (recommended)

1. Create a Cloudflare Turnstile site.
2. Set:
- `VITE_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

If these are blank, the app still runs with honeypot + timing + rate limit checks.
