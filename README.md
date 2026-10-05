# Contour Map Studio

Route Art (Contour Map Studio) turns your runs, rides, and hikes into minimalist contour-map posters. Upload a GPX or pull recent Strava activities, explore auto-detected landmarks, tweak styling (dark mode, water shading, markers, orientation), edit route stats, and export a high-resolution PNG that’s ready to print or share.

## Features
- GPX upload and Strava OAuth import (activity selector flow).
- Auto-detected landmarks with add/remove, custom landmarks, and selection tools.
- Design controls: dark/light, water shading, start/end markers, portrait/landscape aspect ratios.
- Editable stats (route name, location, distance, gain/loss, dates) with overrides.
- Optional flag/custom image badge; PNG export with a tip modal.
- Session persistence so in-progress edits survive refreshes.

## Tech Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS 4
- Map/geo helpers: `@turf/turf`, `@mapbox/polyline`, `osmtogeojson`
- Rendering/export: `jspdf`, `pngjs`

## Prerequisites
- Node 18.18+ (or 20+) and npm.
- Mapbox access token and a Strava API app.

## Environment Variables
Create `.env.local` with:
```
MAPBOX_TOKEN=pk_your_token
STRAVA_CLIENT_ID=xxxx
STRAVA_CLIENT_SECRET=xxxx
NEXT_PUBLIC_STRAVA_CLIENT_ID=xxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
UPSTASH_REDIS_REST_URL=xxxx
UPSTASH_REDIS_REST_TOKEN=xxxx
```
Update `NEXT_PUBLIC_APP_URL` to your deployed URL (e.g., `https://yourdomain.com`) before production.
For purchasing you also need:
```
STRIPE_SECRET_KEY=sk_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxx
PRINTFUL_API_KEY=xxxx
PRINTFUL_WEBHOOK_SECRET=xxxx     # optional; set the same value in the Printful webhook config
PRINTFUL_AUTO_CONFIRM=true       # default true; set to false to create Printful drafts only
CRON_SECRET=xxxx                 # protects /api/cron/*; Vercel sends it automatically
```


`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` power rate limiting on checkout, the Stripe/Printful webhooks, and the Strava proxy endpoints. Create a free database at [console.upstash.com](https://console.upstash.com) and copy its REST URL/token. If unset, rate limiting fails open (disabled) with a console warning — safe for local dev, but **required before unlocking purchasing in production**.

### Strava OAuth Redirects
Add both of these to your Strava app settings:
- `http://localhost:3000/api/strava/auth`
- `https://yourdomain.com/api/strava/auth` (or your Vercel domain)

## Run Locally
```
npm install
npm run dev
```
Visit http://localhost:3000 and upload a GPX or connect Strava, then tweak design and download PNG.

## Build & Start (production)
```
npm run build
npm start
```

## Lint
```
npm run lint
```

## Order Fulfillment (Printful)

Flow for a paid order:
1. Stripe fires `checkout.session.completed` → `app/api/stripe-webhook/route.ts` marks the order rows `paid`.
2. The webhook creates the Printful order and **confirms it immediately** (`PRINTFUL_AUTO_CONFIRM`, default on). Printful charges the store's billing method and starts production — no manual step.
3. Printful status changes come back through `app/api/printful-webhook/route.ts` and show on the customer's `/order/[sessionId]` page.

Decision: orders are auto-confirmed rather than reviewed by hand. A paid order left as a Printful draft is a customer who never gets a poster, and there is no one on the team whose job is to log in to Printful every day. Printful's own prepress checks still catch unprintable files and put the order on hold.

### Daily safety net
`vercel.json` schedules `GET /api/cron/printful-drafts` every day at 07:00 UTC. It lists every draft in the Printful store, confirms the ones that match a paid order in Supabase, and leaves everything else alone (hand-made or test drafts are only reported). The run returns **500 when any draft could not be confirmed or belongs to an unpaid order**, so a failed run in the Vercel Cron dashboard is the signal that a human needs to look. Turn on Vercel's cron/log notifications for this project so that failure reaches your inbox.

To run the sweep by hand:
```
curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/printful-drafts
```

If you ever want manual review instead, set `PRINTFUL_AUTO_CONFIRM=false`. Orders then stay as drafts and the daily sweep will confirm them the next morning — so for true manual review you must also remove the cron entry from `vercel.json` and confirm orders yourself in Printful → Orders → Drafts every day.

## Deploy to Vercel
1) Push the repo to GitHub/GitLab/Bitbucket.  
2) In Vercel: New Project → import repo; framework auto-detects Next.js.  
3) Build command: `npm run build`. Output: default.  
4) Add env vars listed above for Production + Preview (including `CRON_SECRET`, which Vercel uses to call the daily Printful sweep).  
5) Deploy, then set custom domain and update `NEXT_PUBLIC_APP_URL` accordingly.

## Project Structure (key paths)
- `app/layout.tsx` — metadata, fonts, global shell.
- `app/page.tsx` — upload/landing flow.
- `app/view/page.tsx` — editor + canvas view.
- `components/ArtCanvas.tsx` — drawing/export logic.
- `components/EditPanel.tsx` — controls for stats, landmarks, design, download.
- `components/UploadZone.tsx`, `components/StravaConnect.tsx` — data ingestion.
- `lib/strava.ts` — Strava client helpers.
- `public/contour-logo.png` — brand logo used for favicon/tab icon.

## Usage Tips
- Large GPX files: simplify in your GPS app first for smoother rendering.
- If Strava auth fails, confirm redirect URLs and that `NEXT_PUBLIC_APP_URL` matches the deployed domain.
- Exports inherit the current design/dark-mode settings—set them before hitting “Download PNG”.
