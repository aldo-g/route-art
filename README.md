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

### Transactional Email (pre-launch checklist)
The app does not send any email itself. The checkout success page and the Privacy/Terms pages promise a receipt, shipping updates, and a support mailbox, so all three must be backed by third-party settings before purchasing goes live:

1. **Stripe receipts** — Stripe Dashboard → Settings → Business → Customer emails → enable *Successful payments*. Checkout collects the customer's email, so Stripe sends the receipt automatically once this is on. Repeat for test mode if you want receipts while testing.
2. **Printful shipping notifications** — Printful Dashboard → Settings → Stores → *(your store)* → Notifications → enable *Shipping confirmation* (customer-facing). The Stripe webhook already passes the customer's email as the Printful recipient, so Printful can email tracking once the order ships.
3. **Support mailbox** — `hello@contourmapstudio.com` is linked from `/privacy`, `/terms`, and `/returns`. Create it (or an alias/forward) in the domain's mail provider and send a test message to confirm delivery.

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

## Print Files (upload flow)

Printful prints from the file we give it, so the file must be print resolution, not the on-screen preview.

1. In the editor, **Add to cart** renders the poster at the chosen variant's physical size at 300 DPI (`config/products.ts` → `getPrintTarget`, `lib/raster.ts` → `fitPrintSize`). The browser caps the canvas area it will allocate (16 MP on iOS, 24 MP on desktop Safari, 40 MP elsewhere), so the largest sizes land at roughly 200–230 DPI on a laptop and ~140 DPI on a phone. The effective DPI is stored on the cart item and in `posters.config`.
2. The browser asks `POST /api/posters/upload-url` for a poster id and two Supabase signed upload URLs, then PUTs the PNG print file and a small preview **directly to Supabase Storage** (`lib/poster-upload.ts`). Nothing large passes through a Vercel function.
3. Checkout sends only `posterId` per item. `app/api/create-checkout-session/route.ts` verifies the poster row exists and the print file is present in the `poster-images` bucket before creating the Stripe session; Stripe and the order page show the preview, Printful receives the full file.

Storage setup: the `poster-images` bucket must be **public** and its per-file size limit must allow print files. Supabase's default project limit is 50 MB; A1 PNGs can reach 20–30 MB, so raise the limit if you ever see upload failures on the largest sizes. Files uploaded for items that never check out are not cleaned up yet.

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
