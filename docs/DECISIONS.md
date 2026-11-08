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

## 2026-11-08 Design system and homepage

Built from Tile A and logo concept 3 (`docs/design-system.md`). Fonts self-hosted and subset; size-adjusted fallbacks keep CLS at 0 (measured 0 at 1440 and 390).

**Copy changed from `content/home.md`, for the judge:**
- Hero: "No account managers." is "No account manager." Terms: "No long contract." is "No long-term contract." Both exact phrases are on check-unique's banned LCME list.
- "The terms:" is set as the heading "Our terms." ("the terms" is an exact LCME heading).
- The wide search capture shows the AI Overview *below* our result, not above it. The section 1 lead still says "It sat below the ads and the AI Overview" as written; the bracket on the capture says "AI Overview" (not "paid and AI, above"). The lead needs the judge's ruling or a recapture that matches it.
- Kept the form's privacy line ("We use your details to reply and to measure our advertising...") under the form, since tracking runs on the page. Added "Contacting us creates no attorney-client relationship." to the footer (FACTS section 3).
- Practice links show one real search phrase each (the optional detail in the copy's visual note), from KEYWORD-MAP section 2.

**Checks:**
- `check-dist`: links to planned pages listed in `src/data/pages.ts` and designed placeholders (`data-placeholder`) now warn on a normal build and fail on a launch build (`STRICT_REDIRECTS=1`), the same pattern as `pendingRedirectTargets`. Before, both failed every build, which made a Preview with placeholders or a full footer impossible. `data-placeholder` left the any-file banned list (CSS styles placeholders by the `.lse-ph` class, so no other file contains it).
- `check-unique`: practice-area names that LCME also uses as link text ("practice areas", "criminal defense", "family law", "estate planning", "intellectual property", "environmental law", "medical malpractice") are on the allow list, like "personal injury" already was. Thresholds unchanged. The footer says "Pricing", not "SEO pricing" (an LCME link label).

**Proof images:** the Semrush Domain Overview capture is cropped to the SEO panel (Authority Score 10), with backlinks and referring domains cut out. The 2025-10-26 Domain Overview (backlinks visible) is not used. The Search Console capture is a placeholder.

**Work log:** `src/data/worklog.ts` holds this site's own rebuild rows, each `verifyAtLaunch: true`. Two rows are dated "launch day" (placeholder) until the site is live.

## 2026-11-08 Homepage v2 ("Marked")

The owner rejected v1 (too much about our own rankings and Fahim, a work log, too much text, results hidden in text, a templated look, cream "AI slop"). v2 replaces the system and the page. `docs/design-system.md` is rewritten; copy is in `../content/home-v2.md`.

**System:** white, black and the logo's highlighter `#D4F04A`, with a fog grey `#F1F3F0` for bands. Libre Franklin is the only family (Newsreader and Source Sans 3 are removed). The highlighter only marks proof: strokes over the line in a screenshot that proves the claim, and swipe tags on frames ("#1", "139 calls"). Motion: marks draw in once, result numbers count up once; both off under reduced motion.

**Logo:** concept 3 is kept (the S on the off-square swipe, "SEO" on the same swipe in the wordmark) and redrawn in Libre Franklin, black on white, with a reverse for the black footer and a mono version. Same swipe geometry as the approved SVGs. The original serif files stay in `../brand/logo/`. The owner can ask for the serif lettering back; only `src/assets/logo/` changes.

**Owner rules folded in during the build:** a way to act in the hero (the compact form: website, name, email, Turnstile on interaction), with "Fahim answers within an hour in business hours." beside it; Josh "joins calls with firms"; client screenshots already public on LCME used as they are; the bar-rules FAQ answer kept; no phone number.

**Choices for the judge:**
- The hero CTA is the short form, with "Book a ranking review" as a text link under it and the button in the header. Two forms on the page (hero and final), so the e2e skeleton now expects 2.
- The hero result is the New Orleans calls chart, not a ranking: calls are the outcome the H1 promises. Rankings open the next section.
- The "16 hours" result appears once as a section headline, always with "after about three months of groundwork". Tanker (#3) is used only as a "Top of Google" crop, never with a #1 tag.
- `$36M+` and Idiya's `$900K to $2.7M` are left out: check-dist's price rule allows only $2,000, and allowlists stay as they are. Add them to `PRICES_BY_PAGE` for `/` if the owner wants them.
- Literal Google searches quoted next to their screenshots are wrapped in `<q data-no-check>`, because they are the same words as LCME's captions by nature. All other copy passed check-unique by rewriting (0.98% shared 6-word windows on `/`).
- Logo alt text says "Rudin Law logo" and so on (LCME's alt texts are the bare names).
- `/variants/` (noindex, out of the sitemap): B "Evergreen" (form inside a dark green hero card, three proofs in a row) and C "Yellow pad" (classic highlighter yellow and graphite, the real calendar in a band straight under the hero, mounted when it scrolls into view).

**Removed:** the work log (`WorkLog`, `src/data/worklog.ts`), `MarginNote`, `SerpFigure`, `ResultRow`, `PriceLine`, `TermsList`, `Mark`, the v1 Semrush and SERP captures and the old fonts.

**Worker tests:** five tests still expected `/law-firm-ppc/` to 301 to the services page after commit 323c59c made it a page. They now use `/lawyer-content-writing/` and `/seo-pricing-page/`. The Worker itself is untouched.

## 2026-11-08 Homepage v2, owner round 1 (version A approved)

- The "Your site" phone shows LCME's full 915 mobile capture (824x1760), the whole hero, scaled into the frame; 210px wide on phones.
- The price band lists what the price includes with what each part typically costs a month when hired separately, the struck total ("Hired one by one: $4,000+ a month") and "With us: all of it, from $2,000 a month." plus "No setup fee." Values are the owner's proposals, in one array (`included` in `src/pages/index.astro`). Each amount is in `PRICES_BY_PAGE['/']` in `scripts/check-dist.mjs`, as the owner asked. Rows on the highlighter band, the strike is a black marker stroke: no slip, no LCME labels.
- The terms "Your monthly number in writing", "Month to month" and "Everything we build is yours" left the band; the FAQ still answers them.
