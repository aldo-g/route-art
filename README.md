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
```
Update `NEXT_PUBLIC_APP_URL` to your deployed URL (e.g., `https://yourdomain.com`) before production.

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
