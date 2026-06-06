# HTTPS Status

**Resolved as of 2026-06-06.**

`https://casita.bernardoprd.com` is live with a valid Let's Encrypt certificate issued by GitHub Pages. HTTP redirects to HTTPS (301).

## What was fixed

| Date | Action |
|------|--------|
| 2026-06-05 | Cloudflare proxy switched to DNS only (grey cloud); CNAME to `bernieprd.github.io` propagated |
| 2026-06-05 | GitHub Pages custom domain cycled via API to trigger fresh DNS verification |
| 2026-06-06 | GitHub issued the cert; Enforce HTTPS enabled |
| 2026-06-06 | Deleted stale `ALLOWED_ORIGIN` Cloudflare Worker secret (was set to `https://bernieprd.github.io`, causing every CORS response to use the old origin and blocking all API calls) |

## DNS config

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | `casita` |
| Target | `bernieprd.github.io` |
| Proxy | DNS only (grey cloud) |

## Cloudflare proxy note

Cloudflare proxy can optionally be re-enabled for CDN benefits. If you do, set SSL mode to **Full** (not Flexible) so traffic between Cloudflare and GitHub goes over HTTPS too.
