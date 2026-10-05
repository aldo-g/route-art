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

`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` power rate limiting on checkout, the Stripe/Printful webhooks, and the Strava proxy endpoints. Create a free database at [console.upstash.com](https://console.upstash.com) and copy its REST URL/token. If unset, rate limiting fails open (disabled) with a console warning — safe for local dev, but **required before unlocking purchasing in production**.

### Tax (Stripe Tax) — pre-launch checklist
Checkout uses [Stripe Tax](https://docs.stripe.com/tax) to calculate VAT / sales tax from the customer's shipping address (`automatic_tax` in `app/api/create-checkout-session/route.ts`, settings in `config/tax.ts`). Stripe only charges tax in jurisdictions where you have added a registration, so the code alone does nothing until the Dashboard is set up:

1. **Activate Stripe Tax** — Dashboard → Settings → Tax. Set the *origin address* (your business address) and the default product tax code to *General – Tangible Goods* (`txcd_99999999`; the code also sets this explicitly per line item). Repeat in test mode.
2. **Add registrations** — Settings → Tax → Registrations. Add every place you are (or must be) registered: your home-country VAT, the EU OSS scheme once EU cross-border B2C sales pass €10k/year (Stripe reports per-country liability so you can see when), UK VAT, and any US states where you have nexus. Stripe's *Monitoring* tab tells you when a threshold is approaching.
3. **Pricing model** (already decided in code, change in `config/tax.ts` if needed) — prices in EUR, GBP, CHF, NOK, SEK, DKK, PLN, CZK, HUF, RON, BGN, ISK, AUD, NZD and JPY are **tax-inclusive**: the displayed price is the final price and VAT is backed out of it (a €15 poster shipped to Germany nets €12.61). USD and CAD prices are **tax-exclusive**: sales tax is added on top at checkout. If you'd rather keep margins constant on EU/UK sales, raise the EUR base prices in `config/products.ts`.
4. **Database** — run the `amount_*` `ALTER TABLE` lines at the bottom of `supabase/schema.sql`. The Stripe webhook and `/api/verify-session` store subtotal, tax, shipping and total per session so `/order/[id]` can show them.
5. **Local dev without Tax activated** — Stripe rejects `automatic_tax` sessions until step 1 is done. Set `STRIPE_AUTOMATIC_TAX=false` in `.env.local` to create sessions without tax while developing.
6. **Fees** — Stripe Tax is billed per transaction on top of normal processing fees; check the current rate for your account's country.

Not implemented (deliberately): B2B VAT-ID collection / reverse charge. Add `tax_id_collection: { enabled: true }` to the session if business customers become relevant.

### Business details (legal pages)
EU and UK consumer rules require the trader's legal name, geographic address and email to be shown on the store. These live in `config/business.ts` and render on `/terms`, `/privacy`, `/returns` and in the footer. **Replace the bracketed placeholders before launch** — `businessDetailsIncomplete()` returns `true` while any remain. Fill in `vatNumber` once registered; it then appears automatically.

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

## Deploy to Vercel
1) Push the repo to GitHub/GitLab/Bitbucket.  
2) In Vercel: New Project → import repo; framework auto-detects Next.js.  
3) Build command: `npm run build`. Output: default.  
4) Add env vars listed above for Production + Preview.  
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
