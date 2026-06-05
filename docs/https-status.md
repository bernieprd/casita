# HTTPS Provisioning — Status Note

**Date:** 2026-06-05  
**Status:** Waiting on GitHub Pages certificate provisioning

## What happened

The PWA was migrated from `bernieprd.github.io/casita/` to the custom domain `casita.bernardoprd.com`. The Cloudflare DNS CNAME record was originally set to **Proxied** (orange cloud), which caused GitHub Pages to report `InvalidDNSError` — GitHub's servers couldn't see the CNAME pointing to `bernieprd.github.io`, so it couldn't verify the domain or issue an HTTPS certificate.

The Cloudflare proxy was disabled (switched to **DNS only** / grey cloud). DNS is now correctly configured and globally propagated:

```
casita.bernardoprd.com  CNAME  bernieprd.github.io
```

The site serves correctly over HTTP. The GitHub Pages custom domain was cycled via the API on 2026-06-05 to trigger a fresh DNS verification check.

## Current state

- **HTTP:** Working — `http://casita.bernardoprd.com` loads the app
- **HTTPS:** Not yet active — GitHub has not issued the Let's Encrypt certificate
- **Login:** Broken — CORS in the worker only allows `https://casita.bernardoprd.com`, but the page loads over HTTP, causing a CORS mismatch and "Failed to fetch" error on login

## What's needed

GitHub's background DNS verification job needs to run and pass, after which it will automatically provision the cert. This can take **up to 24 hours** after the DNS was corrected.

Once GitHub verifies the DNS, go to:  
**github.com/bernieprd/casita → Settings → Pages → Enforce HTTPS** and enable it.

After HTTPS is confirmed working, also remove the `http://casita.bernardoprd.com` entry from `DEV_ORIGINS` in `worker/src/index.ts` if it was added as a temporary fix.

## DNS config reference

| Field | Value |
|-------|-------|
| Type | CNAME |
| Name | `casita` |
| Target | `bernieprd.github.io` |
| Proxy | DNS only (grey cloud) — must stay OFF until cert is issued |

## Cloudflare proxy note

After GitHub issues the cert, Cloudflare proxy can optionally be re-enabled for CDN benefits. If you do, set Cloudflare SSL mode to **Full** (not Flexible) so traffic between Cloudflare and GitHub goes over HTTPS too.
