# Migrate Frontend from GitHub Pages to Cloudflare Pages

## Context

The frontend is currently deployed to GitHub Pages (via the `gh-pages` branch) while the Cloudflare Worker already lives on Cloudflare. The split causes friction: the `gh-pages` branch drifts out of sync with `main`, deploy failures are harder to debug across two platforms, and there's dead code (`gh-pages` npm package) that's no longer used by the CI workflow.

Moving to Cloudflare Pages consolidates both the worker and frontend under one platform, eliminates the `gh-pages` artifact branch entirely, and simplifies the deployment pipeline.

## What changes

### 1. Create Cloudflare Pages project (manual, one-time)
Run locally or in CI to register the project:
```bash
wrangler pages project create casita-frontend
```

### 2. Update `.github/workflows/deploy.yml`
- Remove `permissions: pages: write` and `id-token: write` (GitHub Pages-only)
- Remove the `environment: name: github-pages` block
- Replace `actions/upload-pages-artifact` + `actions/deploy-pages` steps with:
  ```yaml
  - run: pnpm build:frontend
    env:
      VITE_WORKER_URL: ${{ vars.VITE_WORKER_URL }}
      VITE_CLERK_PUBLISHABLE_KEY: ${{ vars.VITE_CLERK_PUBLISHABLE_KEY }}

  - run: pnpm wrangler pages deploy frontend/dist --project-name=casita-frontend --commit-dirty=true
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  ```
- Keep `needs: deploy-worker` so order is preserved

### 3. Update `frontend/package.json`
- Remove `gh-pages` from devDependencies
- Change deploy script from `pnpm build && gh-pages -d dist` to `wrangler pages deploy dist --project-name=casita-frontend`

### 4. Remove `frontend/public/CNAME`
Cloudflare Pages manages custom domains via the dashboard — the CNAME file is a GitHub Pages-only convention.

### 5. No routing changes needed
The existing `frontend/public/_redirects` file (`/* /index.html 200`) is natively supported by Cloudflare Pages. The `base: '/'` in vite.config.ts is already correct.

## Post-deploy steps (manual, in Cloudflare dashboard)
1. Add custom domain `casita.bernardoprd.com` to the Cloudflare Pages project
2. Update DNS: point `casita.bernardoprd.com` CNAME to `casita-frontend.pages.dev`
3. Disable GitHub Pages in repo Settings → Pages
4. Delete `gh-pages` remote branch

## Verification
1. Push to `main` → GitHub Actions should show a single "Deploy to Cloudflare Pages" step replacing the old GitHub Pages deploy
2. Visit `casita.bernardoprd.com` — app loads and routing works (deep-link to `/shopping` or `/recipes/123`)
3. PWA install prompt still appears (service worker registers correctly)
4. Worker API calls succeed (network tab, no CORS errors)
