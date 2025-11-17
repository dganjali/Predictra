# Predictra Landing (frontend)

 This app can be deployed to Vercel by linking the `frontend/` folder as the project root. Use the default Vite settings.
 
 Notes
 
 Replace the placeholder images in `src/assets/` with `logo.svg`, `favicon.png`, and `hero.png` before deploying.
 Images: for Vercel/static deployment we recommend copying your repo `images/` into `frontend/public/images/` so they are served as static assets at `/images/...` (the app expects `/images/Logo.png`, `/images/factory photo.png`, `/images/icon.png`).
 The Join Waitlist button now posts to a simple serverless endpoint: `/api/waitlist`. A minimal handler is included at `frontend/api/waitlist.js` which attempts to append submissions to `frontend/waitlist-submissions.json` (works locally). NOTE: serverless filesystem persistence is ephemeral on platforms like Vercel; replace the API body with a proper datastore (Supabase, Airtable, DynamoDB, etc.) for production.
 - Optional: Airtable integration — if you prefer a quick hosted datastore, you can configure Airtable and set the following Vercel environment variables: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, and optional `AIRTABLE_TABLE_NAME` (defaults to `Waitlist`). When these are set the serverless function will attempt to create a record in your Airtable base instead of writing to disk.

Vercel deployment notes

- Vercel auto-detects Vite projects. Recommended workflow:
	1. In the Vercel dashboard set Project Root to `frontend`.
	2. Framework Preset: choose `Vite` (or `Other`).
	3. Build Command: `npm run build`
	4. Output Directory: `dist`

- Environment variables (set in Vercel dashboard):
	- `AIRTABLE_API_KEY` — your Airtable API key (optional)
	- `AIRTABLE_BASE_ID` — your Airtable Base ID (optional)
	- `AIRTABLE_TABLE_NAME` — table name (optional, defaults to `Waitlist`)

- If you'd rather keep everything at the repo root without changing Project Root, I previously added a `vercel.json` route helper; I removed it because Vercel detects Vite automatically and it's simpler to set Project Root to `frontend` in the dashboard.

 - If you prefer Supabase instead of Airtable, I can add that quickly — tell me which provider you prefer.
