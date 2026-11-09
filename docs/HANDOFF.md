# Handoff

Updated 2026-11-09, after launch. Branch `rebuild`; `main` was fast-forwarded to the launch commit `d5c602f` with the owner's OK.

## State

**Live since 2026-11-09.** The Worker `lawyerseoexpert-site` owns the apex through the route `lawyerseoexpert.com/*` (version `792f3619`, from `d5c602f`). `LIVE` is `"true"`, `workers_dev` is `false` (the router's noindex depends only on `LIVE`, so the workers.dev host would have served indexable copies). WordPress no longer serves the apex. It still serves `www`, see below. DNS for the apex and `www` was not changed.

Checked after launch:
- `node scripts/verify-live.mjs lawyerseoexpert.com`: all OK, 75 checks, on 2026-11-09 after `0427c2d` (that commit fixed the script, not the site: `/kit/` and `/variants/` are 404 on production by design, and `/login/` is a redirect).
- Old WordPress URLs from `src/data/redirects.ts` 301 in one hop to a 200 page, query string kept.
- `/intake` and `/intake/*` still reach `rudin-intake-staging` (same answer as before launch).
- `www` answers with WordPress's own 301 to the apex, path and query kept (`x-powered-by: PHP`). So `www` legacy URLs take two hops. This depends on WordPress staying up: see step 3 below.
- `robots.txt`, `sitemap-index.xml` and the IndexNow key file are 200 with no noindex. IndexNow: all 34 sitemap URLs sent on 2026-11-09, answer 202.

Cloudflare, as set up for launch:
- D1 `lse-site` (production) has migrations 0001 to 0003 recorded as applied. `lse-site-preview` was not checked.
- Secrets on the Worker: `IP_SALT`, `TURNSTILE_SECRET`, `GA4_API_SECRET`, `REDDIT_CAPI_TOKEN`. **`META_CAPI_TOKEN` is not set**, so Meta gets browser events only.
- Turnstile widget "lawyerseoexpert.com", Managed (as LCME's), hostnames apex, `www` and the workers.dev host. Site key in `src/data/site.ts`.
- Email Sending on `notify.lawyerseoexpert.com` only. Its 6 DNS records all sit under `notify.` (43 records before, 49 after). Sender `leads@notify.lawyerseoexpert.com`. One test lead arrived at fahim@legalcmoexpert.com with DKIM, SPF and DMARC passing, Turnstile ok, and the lead's address as Reply-To. Only `fahim@wpseogeeks.com` is a verified destination address; mail to `fahim@legalcmoexpert.com` works because `notify.` is onboarded, and counts toward the Workers Paid plan's 3,000 included sends a month.
- Tracking (GA4, tag gateway, Meta, Reddit, Search Console): `docs/tracking.md`.
- Workers Builds is **not connected**. Deploys are `npx wrangler deploy` from `site/` on `rebuild`.

The site: 34 indexable pages in the sitemap, built from the design system (`docs/design-system.md`). `/privacy-policy/` and `/terms-and-conditions/` launched with marked placeholders (`data-placeholder`; 10 and 8), the owner's default. A strict build (`STRICT_REDIRECTS=1 npm run build`) fails only on those. Open TODOs are marked `TODO(`.

## Next steps

1. Fill the privacy and terms placeholders (entity name, address, retention, governing law and the rest; tracking, Turnstile, Calendly and pixel disclosures). Then the strict build passes.
2. After 48 hours: `node scripts/broken-report.mjs` and read Workers Logs for `_failed` events. Watch Search Console coverage and the redirects.
3. Before WordPress is retired: add a Cloudflare Redirect Rule `www` to apex keeping path and query (free plan, as LCME's), so `www` stops depending on WordPress and legacy `www` URLs take one hop. Needs the owner's OK.
4. Set `META_CAPI_TOKEN` (owner `!` command) if Meta server events are wanted.
5. Workers Builds: now that `main` equals `rebuild`, it can be connected with `main` as the production branch (build `npm ci && npm run check && npm run build`, deploy `npx wrangler deploy`, preview `npx wrangler preview`). Until then, never let an old `main` build reach this Worker. Check a branch reaches its Preview, and prove rollback once.
6. The consultant page's own-SERP capture still shows the old LCME-style title (`src/data/proof.ts`). Recapture once Google shows LSE's new title.
7. Keep `check-unique` clean. Refresh the snapshot when LCME ships (`npm run refresh-lcme-snapshot`, commit).
8. One Calendly test booking then cancel, with the owner's OK, proves `bookings` and `schedule_call`.

## Owner steps still open

Account `afdd6dc89aef390d5327db09d0c00b8f`, zone `lawyerseoexpert.com`. Auto mode refuses deploys, D1 writes, `wrangler secret put`, Email Sending setup and DNS changes: give the owner the `!` command.

1. Retire WordPress (owner's call, after step 3 above): LCME's order was the `www` rule, then `AAAA @ 100::` proxied and remove the apex A record, then remove the install. Keep `mail.`, the cPanel records, `status.`, `alerts.`, `admin.`, `recordings.`, the verification TXT records and the `/intake` routes.
2. `hello@lawyerseoexpert.com` must exist as a cPanel mailbox or forwarder.
3. Bing Webmaster Tools (see `docs/tracking.md`).
4. Uptime: `/api/health` returns 503 with `outboxStuck: true` after 15 minutes of an unsent lead. `status.lawyerseoexpert.com` is the existing `uptime-monitor` Worker; point a check at `/api/health` if it doesn't already.

## Traps

From LCME (all apply):
1. `compatibility_date` newer than the UTC date breaks the deploy (code 10021). It is `2026-11-08`.
2. `wrangler deploy` replaces the Worker's routes: list only this Worker's.
3. Never call the origin IPs. 1 request per second, through Cloudflare only.
4. Tests must never read production settings: `vitest.config.ts` and `tests/e2e/serve.mjs` pin `LIVE` false. Keep that when adding a setting.
5. An opt-out cookie (`lse_notrack`) silently stops all tracking. Test with `?notrack=0`.
6. Previews do not inherit secrets or vars. `IP_SALT` missing means no rate limit. Blank pixel and email vars on Previews are by design.
7. Production means exactly the two apex hosts. `next.<domain>` must not track or use the real Turnstile key.
8. Reddit pixel is shared with WordPress's plugin during the overlap (doubled Page Visits).
9. GA4 does not dedupe event IDs, so conversions come only from the Worker (`ga4_sent` table, migration 0002).
10. Cloudflare injects the Google tag only for browser requests. Automated browser runs on the live site count in GA4 unless `/analytics/` and Google's hosts are blocked.
11. Auto mode refuses pushes to `main`, production D1 reads, `wrangler tail`, `wrangler secret put` and Email Sending setup. Hand the owner the `!` command.
12. A push can fail to reach its Preview with no sign. Check the Preview's HTML has the change.
13. Rename an endpoint only after `npm run check-blocklists`.
14. Git Bash rewrites arguments that start with `/` (use `MSYS_NO_PATHCONV=1`), heredocs lose backslashes, multi-line `sed` once broke a build. Use Edit and Write.
15. The PC runs short of memory: one Playwright or Vitest worker, one dev server, at most 3 agents. Keep TypeScript on 6.
16. Turnstile may show a checkbox. Agents do not click it. Tokenless leads are kept and flagged `[POSSIBLE SPAM]`.
17. While `LIVE` is not `true`, the Worker adds `X-Robots-Tag: noindex` to everything.

Specific to LSE's zone (`research/CLOUDFLARE-ZONE.md`):
- `mail.lawyerseoexpert.com` is the cPanel mail server (A record, DNS only). Email Sending goes on `notify.lawyerseoexpert.com`. Check nothing else uses `notify.` first.
- A wildcard A record `*.lawyerseoexpert.com` points at the cPanel origin, so any new name already resolves there. Add Email Sending's records on `notify.` without touching the wildcard.
- `status.lawyerseoexpert.com` is the Worker `uptime-monitor`. `alerts.lawyerseoexpert.com` and `send.alerts` carry Resend DKIM and SPF for uptime alerts. Leave all of them alone. Do not connect `uptime-monitor` to Workers Builds.
- Apex mail records (SPF, DKIM `default._domainkey`, DMARC `p=none`) belong to cPanel mail. Leave them. Keep the three `google-site-verification` TXT records, the Google Workspace recovery record and the Pinterest verification.
- `/intake` and `/intake/*` (apex and `www`) are routed to a different Worker, `rudin-intake-staging`. This site must never create pages or redirects under `/intake`. `check-dist` and `tests/worker/redirects.test.ts` fail if it does, and `wrangler.jsonc` lists only `lawyerseoexpert.com/*` for this Worker. After launch, check `/intake` is not shadowed by this Worker.
- `dev.` and `dms.` subdomains return 526 and are not part of the Worker. Leave them unless the owner says.
- `check-unique`'s leak list bans the LCME Calendly slug except in the one shared URL. Changing the Calendly URL later means editing `leakAllowedContexts`.
