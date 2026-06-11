# Cutover Plan: Migrate from `app.casita.bernardoprd.com` to `dashboard.mycasita.app`

The new domain (`dashboard.mycasita.app`) is live. The old domain (`app.casita.bernardoprd.com` / `casita.bernardoprd.com`) is no longer available. This document lists every remaining artifact that still references the old domain and the steps to clean them up.

---

## 1. Code Changes

### `worker/src/index.ts`

- Line 18: `DEFAULT_ORIGIN` is still `'https://app.casita.bernardoprd.com'`. Change to `'https://dashboard.mycasita.app'`.
- Line 19: `PROD_ORIGINS` still includes `'https://app.casita.bernardoprd.com'`. Remove it — only `'https://dashboard.mycasita.app'` belongs in the array now.
- Line 18 comment (`// casita.bernardoprd.com kept during subdomain migration; remove after Phase 3 cutover`) is already obsolete — delete it along with the old origin.

```ts
// Before
const DEFAULT_ORIGIN = 'https://app.casita.bernardoprd.com'
const PROD_ORIGINS = ['https://app.casita.bernardoprd.com', 'https://dashboard.mycasita.app']

// After
const DEFAULT_ORIGIN = 'https://dashboard.mycasita.app'
const PROD_ORIGINS = ['https://dashboard.mycasita.app']
```

### `worker/src/routes/recipes.ts`

- Lines 169, 179: fallback value `'https://app.casita.bernardoprd.com'` → `'https://dashboard.mycasita.app'`.
  These are only reached if `APP_BASE_URL` is not set in `wrangler.toml`, so this is a safety-net fix.

### `worker/src/routes/recipes-d1.ts`

- Line 209: same fallback — `'https://app.casita.bernardoprd.com'` → `'https://dashboard.mycasita.app'`.

### `worker/src/routes/google-auth.ts`

- Line 74: fallback `'https://app.casita.bernardoprd.com'` → `'https://dashboard.mycasita.app'`.
  Note: the actual redirect URI used for OAuth is driven by `env.GOOGLE_REDIRECT_URI` (the wrangler var), not this fallback, so this is a belt-and-suspenders fix.

### `worker/wrangler.toml`

- Line 16: `GOOGLE_REDIRECT_URI` is still `"https://casita-worker.bernardoprd.workers.dev/auth/google/callback"`.
  This is the Workers `.dev` subdomain, not the custom domain — **this must match the URI registered in Google Cloud Console**. Options:
  - If the Worker now has a custom route on `mycasita.app` (e.g. `api.mycasita.app`), change to `"https://api.mycasita.app/auth/google/callback"` and update Google Cloud Console to match.
  - If you plan to keep using the `bernardoprd.workers.dev` subdomain as the API endpoint for now, this value is technically still correct but should be updated when the Worker gets its own custom domain.

### `frontend/vite.config.ts`

- Line 41: `urlPattern` for the PWA's `runtimeCaching` still matches `casita-worker.bernardoprd.workers.dev`. This determines which API calls are cached offline.
  - If the Worker gains a custom domain (`api.mycasita.app`), update this to match the new hostname.
  - If you continue using `casita-worker.bernardoprd.workers.dev` as the API endpoint, this line can stay — but the hostname is misleading and should be updated when the Worker domain changes.

### `CNAME` (repo root)

- Currently contains `app.casita.bernardoprd.com`. This file is used by GitHub Pages to set the custom domain for a `gh-pages` branch deployment.
- The frontend is now deployed via **Cloudflare Pages** (`deploy.yml` line 63), not GitHub Pages, so this file is irrelevant. **Delete it.**

### `README.md`

- Line 5: `**Live at [casita.bernardoprd.com](https://casita.bernardoprd.com)**` → update URL and display text to `https://dashboard.mycasita.app`.

---

## 2. Infrastructure

### Cloudflare Workers — Custom Domains

- Verify the Worker (`casita-worker`) does **not** have `app.casita.bernardoprd.com` or `casita.bernardoprd.com` listed as a custom domain in the Cloudflare dashboard under **Workers & Pages → casita-worker → Settings → Domains & Routes**. Remove any such routes if present.
- If the Worker currently has no custom domain on `mycasita.app`, the API URL stays at `casita-worker.bernardoprd.workers.dev`. That's fine for now, but consider adding a custom route (`api.mycasita.app`) to fully decouple from the old domain.

### Cloudflare Pages — Custom Domain

- Confirm that `dashboard.mycasita.app` is set as the production custom domain for the `casita-frontend` Pages project (**Workers & Pages → casita-frontend → Custom Domains**).
- Remove `app.casita.bernardoprd.com` from the Pages custom domains list if it still appears there.

### DNS on `bernardoprd.com`

Records that can be removed once the old domain is fully decommissioned:

| Record type | Name | Was pointing to |
|---|---|---|
| CNAME | `app.casita` | Cloudflare Pages (`casita-frontend.pages.dev`) |
| CNAME | `casita` | Cloudflare Pages (original root subdomain) |
| CNAME | `casita-worker` | (Workers `.dev` subdomain — this is auto-managed by Cloudflare, not a DNS record you created, but verify) |

Check the `bernardoprd.com` zone in Cloudflare DNS and delete any `casita`-prefixed records that no longer serve a purpose.

### Google Cloud Console — OAuth Redirect URIs

- In the Google Cloud Console for the project powering Google Calendar integration, remove `https://app.casita.bernardoprd.com` (and `https://casita.bernardoprd.com` if present) from the **Authorized redirect URIs** list.
- If the Worker gets a new custom domain, add that URI at the same time and update `GOOGLE_REDIRECT_URI` in `wrangler.toml`.

### Clerk — Allowed Origins / Redirect URLs

- In the Clerk dashboard, check **Allowed origins** and **Redirect URLs** for any `casita.bernardoprd.com` entries and remove them. Add `https://dashboard.mycasita.app` if not already present.

---

## 3. Verification Steps

1. **CORS** — Open `https://dashboard.mycasita.app` in a browser, open DevTools Network tab, make any authenticated API call (e.g. load the shopping list). Confirm no `CORS` errors and the `Access-Control-Allow-Origin` response header is `https://dashboard.mycasita.app`.

2. **Google OAuth** — Go to Settings → Calendar, connect Google. Confirm the OAuth redirect brings you back to `dashboard.mycasita.app/settings?google=connected` without any redirect_uri mismatch error.

3. **Recipe share links** — Share a recipe and confirm the generated URL uses `https://dashboard.mycasita.app/share/...`.

4. **PWA offline** — Install the app on mobile, go offline, navigate around. Confirm cached API responses still load. (This checks the `vite.config.ts` `urlPattern` is matching the actual Worker hostname.)

5. **No old-domain references in source** — After implementing the changes, run:
   ```bash
   grep -r "casita\.bernardoprd\.com\|bernardoprd" \
     --include="*.ts" --include="*.tsx" --include="*.toml" \
     --include="*.md" --include="CNAME" \
     --exclude-dir=".claude" .
   ```
   Expected output: no matches (or only this doc and historical docs in `docs/`).

6. **CI deploy** — Push to `main` and confirm the GitHub Actions deploy workflow completes successfully with no domain-related errors.
