# Decisions

Newest at the bottom. Log yours.

## 2026-11-08 Back end fork from LCME

**Ported (renamed `lcme` to `lse`, `cmo-` classes to `lse-`):**
- `worker/` whole: router, `/api/lead` with Turnstile, `/api/activity`, email and outbox, Reddit CAPI, GA4, Meta, broken-page log, health, crons. Only the failure message wording changed (no "within 1 hour").
- `migrations/` 0001 to 0003.
- `src/features/tracking/` whole, `src/features/booking-dialog/` (logic kept, looks and wording reduced to placeholders).
- `src/scripts/forms.ts` and `calendly.ts` unchanged apart from names. `LeadForm.astro`, `CalendlyInline.astro`, `Faq.astro` kept as bare markup with the `data-*` hooks the scripts need. `Seo.astro` kept as is.
- `Base.astro` skeleton with a plain header and footer. `features.ts`, `site.ts`, `redirects.ts` rewritten for LSE.
- Scripts: `check-dist` (rewritten rule tables), `verify-live`, `broken-report`, `indexnow` (new key file), `check-blocklists`, `seo-baseline` (LSE's WordPress URL list).
- Tests: all of `tests/worker/`, `tests/tracking/`, `tests/runtime/`, e2e `helpers.ts` and `serve.mjs`, plus new `tests/worker/redirects.test.ts`, `tests/unique/` and `tests/e2e/skeleton.spec.ts`.
- Config: `wrangler.jsonc`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json`, `.node-version`, `.gitignore`, `astro.config.mjs` (no markdown plugin).

**Left out, and why:**
- WordPress migration fences (`check-sources`, `check-post-text`, `check-page-text`, `compare-port`, `convert-wp-posts`, `lib/moved-pages`, `lib/repair-sample-lists`, `export-wp`): they hold rebuilt pages word for word to WordPress. LSE copy is all new.
- Client proposals (`/prepared-for/`), the settlement calculator and `settlement.ts`, `LeadEmailCard`, `SystemPage`: LCME-only.
- Every LCME page, section and visual component, CSS, fonts and images.
- Blog machinery (content collection, RSS, `[post].astro`, post date helpers): the 9 posts will be rewritten (PLAN Q2). Port the pieces when the blog is built. The router already serves `/feed/` from `dist/feed.xml` if one exists.
- Exit-intent offer, sticky mobile bar and image zoom: LCME copy and look. The design phase can add them in `features.ts`. `ExitOfferShown` stays in the Worker's event list.
- LCME e2e specs for forms, tracking and Meta: tied to LCME markup and IDs. A small `skeleton.spec.ts` replaces them. Port the full ones once LSE's markup is fixed.

**Changed on purpose:**
- Email sender is `leads@notify.lawyerseoexpert.com`, not `mail.` (the cPanel mail server on this zone, see `research/CLOUDFLARE-ZONE.md`).
- `workers_dev` is `true` and `LIVE` is `"false"` until launch. The route is commented out so a push to `main` cannot take over the live WordPress site.
- `check-dist`: the price rule allows `$2,000` only; copy rules are style rules plus the old WordPress claims; the Meta verification-tag and post `lastmod` checks are removed; redirect targets that are not built yet are allowed only if listed in `pendingRedirectTargets` (a warning), and the list must be empty for a launch build (`STRICT_REDIRECTS=1`). An `/intake` check was added.
- Placeholder pages (`/`, `/contact-us/`, `/privacy-policy/`, `/thank-you/`, `/404`) use wording chosen to differ from LCME. `/privacy-policy/` is noindex until written.
- Known flake inherited from LCME: `tests/worker/lead.test.ts` "never logs contact details" can fail once in a while when a random ID in the log contains "555". Re-run.

## 2026-11-08 check-unique

Implemented as designed in `research/INFRA-REUSE.md` section 7, with these details. A shared 10-word run fails (30 on legal pages); 7 to 9 words warn. 6-word windows: warn above 2% and fail above 4% per page, fail above 2.5% sitewide, pages under 150 words not counted. An exact heading, title, description, link or button match with LCME fails when it has 2 or more words and is not allowed; headings of 5 or more words fail at Jaccard above 0.8. Banned phrases fail anywhere on the page; watch phrases warn. The leak scan runs on every text file in `dist/`. All lists and thresholds are in `scripts/unique-config.json`. The shared Calendly link is stripped from the leak scan on purpose (the owner chose to share the event). LCME text comes from `LCME_DIST`, else the sibling `dist/`, else the committed snapshot.
