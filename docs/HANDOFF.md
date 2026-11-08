# Handoff

Updated 2026-11-08. Branch `rebuild` (not pushed).

## State

The technical foundation is in place, forked from LCME's back end, with a bare placeholder front end. Green on: `npm run check`, `npm run build` (check-dist, then check-unique), `npm run test` (Worker, tracking, runtime, uniqueness), `npm run test:e2e` (6 skeleton tests, one worker).

Nothing exists in Cloudflare yet for this site: no D1, no Worker, no secrets, no DNS or route change. Nothing was deployed or pushed.

Design system and homepage built (Tile A, logo concept 3): `docs/design-system.md`, screenshots in `docs/shots/`. The homepage `/` is real copy from `content/home.md` with designed placeholders where captures are missing. Still placeholder pages: `/contact-us/` (lead form and booking dialog wired), `/thank-you/`, `/404`, `/privacy-policy/` (noindex until written). Open TODOs are marked `TODO(design)`, `TODO(copy)`, `TODO(owner)`, `TODO(Cloudflare)`, `TODO(blog)`: search for `TODO(`.

## Next steps

1. Build the inner pages with the components in `docs/design-system.md`. Every planned page is in `src/data/pages.ts`; the build warns about links to unbuilt ones and placeholders, and a launch build fails on both.
2. Before launch: recapture the search result at full size, the Search Console and result captures (placeholders list on the homepage), confirm Josh's photo, and have the judge check every row in `src/data/worklog.ts`.
3. As each redirect target page ships, remove it from `pendingRedirectTargets` in `src/data/redirects.ts`. A launch build must pass with `STRICT_REDIRECTS=1 npm run build`.
4. Write the privacy policy (tracking, Turnstile, Calendly and ad-pixel disclosures), then drop `noindex`. Add the Meta verification tag to `Base.astro` once the dataset exists.
5. Keep `check-unique` clean as pages land. Refresh the snapshot when LCME ships (`npm run refresh-lcme-snapshot`, commit).
6. Port the fuller e2e specs (forms, tracking, Meta) from LCME once markup is fixed.

## Cloudflare and owner steps still to do, in order

Account `afdd6dc89aef390d5327db09d0c00b8f`, zone `lawyerseoexpert.com`. Auto mode refuses some of these; give the owner the `!` command.

1. GitHub: confirm Cloudflare's GitHub app covers `SM-Fahim/Lawyer-SEO-Expert`. Push the `rebuild` branch only when the owner says.
2. Create the D1 databases: `npx wrangler d1 create lse-site --location enam` and `lse-site-preview`. Paste both IDs into `wrangler.jsonc` (the empty `database_id` fields). Apply migrations to each: `npx wrangler d1 migrations apply lse-site --remote` and the preview one. Apply `0002_ga4_sent.sql` before GA4 is switched on.
3. Create the Worker through Workers & Pages, GitHub, named exactly `lawyerseoexpert-site`. Build command `npm ci && npm run check && npm run build`, deploy `npx wrangler deploy`, preview `npx wrangler preview`, preview builds on. Check a branch really reaches its Preview. Prove rollback once.
4. Turnstile: new widget for `lawyerseoexpert.com` and `lawyerseoexpert-site.fahim-afd.workers.dev`. Site key into `turnstileSiteKey` in `src/data/site.ts`. Secrets via `wrangler secret put` (the owner pastes at the prompt): `TURNSTILE_SECRET`, `IP_SALT`.
5. Email Sending on `notify.lawyerseoexpert.com`: `npx wrangler email sending enable notify.lawyerseoexpert.com` (the CLI). Snapshot the apex and zone DNS before and diff after: every new record must sit under `notify.`. Not `mail.` (cPanel mail server, A record, DNS only), not the apex, never Email Routing. The owner clicks the verification link for each destination address (`fahim@wpseogeeks.com`, `fahim@legalcmoexpert.com`). `hello@lawyerseoexpert.com` must exist as a cPanel mailbox or forwarder.
6. Secrets: `REDDIT_CAPI_TOKEN` (the old plugin's token, by key name only), `GA4_API_SECRET`, `META_CAPI_TOKEN` (optional). Trap: `wrangler secret put` uploads an empty value if a pipe before it fails and still says Success. Secrets on the production Worker do not reach Previews.
7. GA4 property and measurement ID into `wrangler.jsonc` and `site.ts` (both places). Meta dataset ID likewise, plus the domain verification tag. Google tag gateway on the zone. GA4 admin: key events `generate_lead` and `schedule_call`, `calendly.com` unwanted referral, custom dimension `source_form`.
8. Pre-launch checks on the workers.dev host (set `LIVE` stays false): test lead arrives, Reply-To works, row in D1, failure drills, one Calendly test booking then cancel. Each live side effect needs the owner's OK.
9. Launch (Phase 5, owner OK on the exact change): uncomment the route in `wrangler.jsonc` (`lawyerseoexpert.com/*`, zone `lawyerseoexpert.com`), set `LIVE` to `"true"` and `workers_dev` to `false`, DNS per the owner, `www` redirect rule. Then `node scripts/verify-live.mjs lawyerseoexpert.com`, `scripts/indexnow.mjs --send --all` (needs `INDEXNOW_KEY`, the file name in `public/*.txt`), submit the sitemap, `scripts/broken-report.mjs` after 48 hours.
10. Uptime: `/api/health` returns 503 with `outboxStuck: true` after 15 minutes of an unsent lead. `status.lawyerseoexpert.com` is the existing `uptime-monitor` Worker.

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
