Deployment notes — make Vercel builds succeed immediately

Problem summary
- Vercel (or other serverless builders) can run into build failures when pip tries
  to build source distributions for large ML libraries (TensorFlow, NumPy, etc.).
  This often happens when the builder is using Python 3.12 or when wheels aren't
  available for the target Python version.

Instant fix applied in this repo
- The ML-heavy dependencies were moved out of the main backend requirements file
  into `backend/requirements-ml.txt`.
- The runtime requirements that Vercel should install are now only the lightweight
  runtime packages in `backend/requirements.txt` (Flask, Werkzeug, etc.).

What this means
- Vercel can now install and deploy the application without attempting to build
  large ML binary wheels, so builds should succeed.
- The ML dependencies are intentionally omitted from Vercel deployments. If your
  app needs ML inference, host the ML model on a separate service (a small VM,
  Railway, Heroku, or a container) that can install TensorFlow and other packages.

How to deploy on Vercel (recommended quick steps)
1. Ensure `runtime.txt` at the repo root or the Vercel project settings specify Python 3.11.
2. In the Vercel Project > Settings > Build & Development, set the Install Command to:
   ```
   python -m pip install --upgrade pip setuptools wheel
   python -m pip install --prefer-binary -r backend/requirements.txt
   ```
   This ensures setuptools/wheel are available to the build and that pip prefers
   binary wheels where possible.

3. Use `backend/requirements-ml.txt` only on dedicated ML hosts (local dev or a
   separate server):
   ```
   python -m pip install -r backend/requirements-ml.txt
   ```

4. Set `BACKEND_URL` environment variable in your Vercel Project Settings to the
  externally hosted backend (e.g., `https://your-backend.example.com` or
  `http://localhost:3000` for local testing). The repository includes a serverless
  proxy at `api/[...proxy].js` that forwards `/api/*` calls to `BACKEND_URL` so
  the frontend can use the same `/api/...` paths in production.

Environment variables to configure in Vercel (example):
- BACKEND_URL=https://your-backend.example.com
- NODE_ENV=production

Mailing list (SendGrid) setup
- To enable real mailing list notifications, set the following environment variables in Vercel:
  - SENDGRID_API_KEY — your SendGrid API key
  - OWNER_EMAIL — the email address that should receive subscription notifications

Example:
- SENDGRID_API_KEY=SG.xxxxx
- OWNER_EMAIL=you@yourdomain.com

If these are not set, the built-in `/api/subscribe` endpoint will return a success response but won't send notifications; it will still log the email in Vercel function logs for manual retrieval.

Note about static assets and the Next.js migration
- The Next.js app expects the main CSS to be at `/css/styles.css` and images to
  live in `/public/images/`. To ensure Vercel has those files during build, the
  project's `vercel.json` runs `node scripts/copy-images.js` before `next build`,
  copying `frontend/images/*` into `public/images/`. No manual step is required
  before deploying to Vercel; the build will populate the `public/` folder automatically.

If `BACKEND_URL` is not set, API calls to `/api/*` will return a clear 501 JSON
error explaining the missing configuration.

Optional: If you want Vercel to host a lightweight API but still call the ML
service, change your code so imports of TensorFlow or other heavy libs are
performed lazily (inside the endpoint that needs them) and only when that
endpoint is running on a host that has installed `requirements-ml.txt`.

If you want, I can:
- add a `vercel.json` with a safe build command, or
- attempt a local install test under Python 3.11 in this environment and report output.
