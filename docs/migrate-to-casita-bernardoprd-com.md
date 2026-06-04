# Migrate to casita.bernardoprd.com

Move the app from `bernieprd.github.io/casita/` to `casita.bernardoprd.com`, using the same GitHub Pages + CNAME approach as the product-design repo. The Cloudflare Worker API stays at `casita-worker.bernardoprd.workers.dev`.

---

## Code changes (5 files)

### 1. `frontend/public/CNAME` — new file
```
casita.bernardoprd.com
```

### 2. `frontend/vite.config.ts` — line 49
```ts
// before
base: mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/casita/') : '/',

// after
base: '/',
```

### 3. `worker/src/index.ts` — line 11
```ts
// before
const DEFAULT_ORIGIN = 'https://bernieprd.github.io'

// after
const DEFAULT_ORIGIN = 'https://casita.bernardoprd.com'
```

### 4. `worker/wrangler.toml` — line 17
```toml
# before
APP_BASE_URL = "https://bernieprd.github.io/casita/#"

# after
APP_BASE_URL = "https://casita.bernardoprd.com/#"
```

### 5. `worker/src/routes/recipes.ts` — lines 142 & 152
```ts
// before
const appUrl = env.APP_BASE_URL ?? 'https://bernieprd.github.io/casita/#'

// after
const appUrl = env.APP_BASE_URL ?? 'https://casita.bernardoprd.com/#'
```

---

## Manual steps (one-time, outside the repo)

### A. DNS — Cloudflare dashboard for bernardoprd.com
Add a CNAME record:
- **Type:** CNAME
- **Name:** `casita`
- **Target:** `bernieprd.github.io`
- **Proxy status:** DNS only (orange cloud OFF) — required for GitHub Pages TLS verification

### B. GitHub Pages — casita repo settings
Settings → Pages → Custom domain → enter `casita.bernardoprd.com` → Save.
Wait for green "DNS check successful" and TLS cert (~5–15 min), then enable "Enforce HTTPS".

### C. Re-deploy
Push any commit (or trigger `workflow_dispatch`) after DNS + Pages are configured.

---

## Verification checklist
- [ ] `https://casita.bernardoprd.com` loads the app
- [ ] Recipe share URL reads `https://casita.bernardoprd.com/#/share/<token>`
- [ ] API calls still go to `casita-worker.bernardoprd.workers.dev`
- [ ] PWA install works on mobile
- [ ] Auth login/logout works (Worker CORS now only allows the new origin)
