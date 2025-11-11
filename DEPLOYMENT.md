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

Optional: If you want Vercel to host a lightweight API but still call the ML
service, change your code so imports of TensorFlow or other heavy libs are
performed lazily (inside the endpoint that needs them) and only when that
endpoint is running on a host that has installed `requirements-ml.txt`.

If you want, I can:
- add a `vercel.json` with a safe build command, or
- attempt a local install test under Python 3.11 in this environment and report output.
