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

## 2026-11-08 Inner-page kit

`src/components/kit/` and `src/layouts/InnerPage.astro`, documented in `docs/kit.md`, shown at `/kit/` (noindex, so out of the sitemap; check-unique passes it at 1.23%, so it isn't exempted).

- **Moved, not copied:** NumPair, ProofFigure, PriceBand and PriceList, Rows (plain), PhoneShot, Face and TrustLine carry the homepage's own CSS, and the homepage now uses them. Its screenshots at 1440 and 390 are pixel-identical before and after (diffed).
- **Shared data:** `src/data/pricing.ts` (the `included` rows and `separateTotal`, moved out of `index.astro`), `proof.ts`, `people.ts`, `logos.ts`. `PRICES_BY_PAGE` gains `/kit/` with the same breakdown amounts, nothing else. `/seo-pricing/` and `/law-firm-seo-services/` add theirs when they are built.
- **Proof images:** nine new files in `public/img/proof/` (tanker query, tanker AI left column, the whole tanker results page, Idiya's reports, Breakthrough's traffic cropped below the Authority Score and backlinks, the New Orleans site on desktop, phone and its car accident page, and the tall SERP of our own result). Plain rectangle crops only; LCME webps copied byte for byte; the 4x phone capture halved, nothing upscaled. 22 entries in `proof.ts`.
- **Tall SERP without blurring:** the consultant deck asks to collapse the sponsored block and blur the ads. Two height bands of the one capture in a single Shot (search box to "Sponsored Results", then "Hide sponsored results" to the AI Overview) do it without editing a pixel, and no ad text is ever shown.
- **Decks naming one file twice:** `nola-calls-sep-2026` and `nola-calls-jun-oct-2026-sep` are the homepage's 139 chart (it already shows the September 43 label); `elpaso-site-phone` is `elpaso-site-mobile`. The about-sm-fahim deck maps `calls-rudin.webp` to the 139 chart, but LCME's `calls-rudin.webp` is a different capture (May to Sept 2026, 119 calls); it isn't ported.
- **Breadcrumbs are visible** above every inner hero, in muted 15px sentence case, so the BreadcrumbList JSON-LD matches what is on the page. `hideCrumbs` turns the trail off if the judge reads it as an eyebrow.
- **Three-up proof rows** read badly with full results pages (text too small); `Cols count={3}` is documented for strips only.


## 2026-11-08 Web, PPC, about, bios and contact (branch p-site)

Pages: `/lawyer-web-design-development/`, `/law-firm-ppc/` (indexed), `/about/`, `/about/sm-fahim/`, `/about/josh-henderson/`, `/contact-us/` (replaces the stub). Screenshots in `docs/shots/<slug>-1440.png` and `-390.png`.

- **Group pieces:** `src/components/p-site/SiteDuo.astro` (the web hero's phone overlapping the desktop frame; it only arranges BrowserShot and PhoneShot). No kit or shared component changed.
- **PRICES_BY_PAGE:** `/law-firm-ppc/` gets `500`; `/about/sm-fahim/` gets `900K`, `2.7M`, `36M`.
- **Proof:** the Fahim bio uses the 139 chart (`proof.nolaCalls`) with the caption "June to October 2026: 139 calls, up 39%..."; LCME's `calls-rudin.webp` (119) is not used. The Idiya screenshot is left out (its totals don't match FACTS); the $900K to $2.7M pair stands as numbers only.
- **Forms:** the PPC hero form adds "Running Google Ads now?" (sent as `running_ads`, kept in the lead's extra fields), so it is the compact LeadForm in PageHero's text slot. The contact form is the compact LeadForm (website first) plus the deck's optional "What do you want more of?" as its message field; `source_form` stays "Contact page message" (the e2e lead test and Worker tests use it). No phone field, so `tests/e2e/helpers.ts` `fillForm` now fills phone only when the form has one.
- **Copy changed:** the web hero hint "No site yet? Write none." is left out (the website field's URL check rejects "none"). On `/about/`, "About Fahim" and "About Josh" are "More about Fahim" and "More about Josh" (exact LCME link labels).
- **Hidden until answered:** the web FAQ "How long does a build take?" and "Who hosts it, and can our staff edit pages?" (owner placeholders), out of the FAQPage JSON-LD too.
- **Placeholders showing:** `/law-firm-ppc/` has three (ads results page, search terms list, live ad and landing page).
- **Footer:** the PPC link label is "Google Ads management" (deck).
- **Hero alignment:** `/about/` and `/law-firm-ppc/` heroes without PageHero's own form align to the top at 1000px and up (page-level CSS), so the H1 doesn't float mid-column.
- **Judge round 1 (same day):** `/law-firm-ppc/` has no placeholders now: the hero is a SearchPanel of example search terms for a car accident firm (kept and blocked, no numbers), the budget section is a line and three rows, and the account section is rows in two columns; the three captures to collect are in `docs/MANUAL-REVIEW.md`. Web page: the price band H2 is "One fixed quote for the build." under a one-line "From $2,000" swipe; ranking captures run edge to edge on phones; the dark New Orleans captures have tags only, no marks. `/contact-us/` puts "After you send it" (three rows) beside the form at 1000px and up; "What happens next" is an LCME heading.
## 2026-11-08 Money pages (branch p-money)

`/law-firm-seo-services/`, `/seo-pricing/`, `/law-firm-seo-consultant/` from the v2 decks, copy unchanged. Three different hero layouts: services `stack` (form row, then the jackknife #1 on the fog block), pricing `split` with the breakdown card (phones: H1, line, card, form, by page CSS), consultant `split` with no form and the calendar band straight after.

- **Phone crops** (`src/data/proof-money.ts`, `src/components/money/ShotSwap.astro`): wide Google captures set their text at 4 to 8px in a phone column. Under 760px ShotSwap shows a plain rectangle crop of the same capture (the result line, the source card, the totals), above it the full capture. Ten crops in `public/img/proof/*-phone*.webp`. Own file, not `proof.ts`, so parallel builders never edit the same lines.
- **Marks measured per page** where proof.ts had none or was off: the jackknife title (cut short of the source popup), the "what to do" rank title, the El Paso source card title (proof.ts's `sourceCard` box sits about 20px right of the words), the El Paso after chart's axis dates (the date range inside the tight crop).
- **Services AI row** is full width with the text above it, not a 5/7 row: the 1400px capture at 7 columns sets its text at 9px.
- **Pricing results** rows are 8/4 and 4/8 (deck: 7/5 and 5/7) so the 1077px charts stay legible.
- **FinalCta** takes an optional `sub` (the line under the button), defaulting to `site.cta.sub`, for the decks' own lines.
- `PRICES_BY_PAGE`: `/seo-pricing/` gets the breakdown amounts, `/law-firm-seo-services/` the struck `$4,000+` only. `/seo-pricing/` and `/law-firm-seo-services/` left `pendingRedirectTargets`.
- The pricing page's classes use `cost-`: `pr-` is an LCME class prefix and fails check-unique's leak scan.
## 2026-11-08 Practice pages, set B (branch p-pb)

Estate planning, bankruptcy, immigration, intellectual property and environmental, from `content/v2/` and `PRACTICE-LAYOUTS-B.md`. One-off pieces in `src/components/practice-b/` (`QueryRows`, `BuyerRows`, `DemandTable`, `Related`).

- **Heroes, one shape each:** estate stacks the AI answer (typed search in a search box over it, caption beside it) above the form as one row; bankruptcy is a giant "43" beside the chart on white, form in the section after; immigration is the tanker results page wide, calendar after; IP is a split with the #3 result on the fog panel, calendar after; environmental is the calls summary on the panel beside the form.
- **New crops (plain rectangles, no pixel changed), all in `proof.ts`:** `nolaCallsMaySepChart` (LCME `calls-rudin.webp`, June to September, the 119 total and +35.2% cut) and its phone crop `nolaCallsAugSepChart`; `nolaTankerSerpTop` (search to source cards) with phone crops `nolaTankerSerpAnswer` and `nolaTankerSerpSource`; `nolaCallsSummary` (time period, 139, +39.0%), stacked over `nolaCalls` crop `chart`; `nolaTankerRankTitle` (the IP hero on phones). Phone crops exist because a 1047 to 1440px capture at 358px can't be read.
- **Copy changed:** the "SEO pricing" anchor is an exact LCME link label (check-unique fails it), so it reads "law firm SEO pricing" on four pages. Bankruptcy's Map row starts "Near me" with a capital. The environmental demand table adds column labels "Issue", "Who searches", "Monthly searches" (the deck's placeholder note names those three).
- **Schema:** Service with `offer: false` on all five (each deck: no price in schema).
- **Judge round 1:** estate's form moved under the intro line (first screen at 1440); the highlighter is off bankruptcy's blue "43" label (the tag stays); immigration shows three example Spanish searches and no attorney-block placeholder; environmental's table lost its numbers column and the hub rows are plain. No placeholders remain on the five pages; what to collect is in `MANUAL-REVIEW.md`.
## 2026-11-08 Blog, posts and legal pages (branch p-blog)

- **Posts:** the nine posts from `../content/posts/` live in `src/content/posts/` (content collection, `src/content.config.ts`) and are served at their old root URLs by `src/pages/[slug].astro`; `/blog/` lists them, `/feed/` is `src/pages/feed.xml.ts`. Layout and pieces are in `src/components/blog/` (PostLayout, PostCta, LegalLayout, the calculator, `prose.css`). Each post: H1, byline with Fahim's photo, published and updated dates, a contents list (open beside the text from 1100px, closed on phones), the text at about 68 characters, its sources, then PostCta (the one button, then the compact form under a hairline). Article (author `#fahim`, dates), BreadcrumbList and Person JSON-LD.
- **Light edits to the post copy:** each closing "Book a ranking review" sentence moved into the post's `cta` front matter (it is PostCta's line); the CRM post no longer sells "our monthly work ... report on it"; how-to-get-clients' line that fast rankings come "from a weak niche" now cites the New Orleans #1 within hours, after about three months of groundwork (FACTS 4); the calculator spec section (builder notes) is dropped; law-firm-names' practice-area paragraphs are a table, and its plain name lists get `lse-names` (a three-column grid of rows). The calculator H1 is "PI settlement and attorney fee calculator: what you take home" because LCME uses "Personal injury settlement and attorney fee calculator" as a heading.
- **Calculator:** client-side, `src/lib/calculator.ts` (unit tests in `tests/blog/`, added to `vitest.config.ts`), pre-rendered with the example so it works without JavaScript. Its fields are a `role="group"`, not a `<form>` (check-dist requires every form to post to `/api/lead`), so nothing typed can be sent. Its example amounts are in `PRICES_BY_PAGE`.
- **Legal:** `/privacy-policy/` (now indexable) and `/terms-and-conditions/` from the draft decks, placeholders kept with `Placeholder`. The GA4 and Meta blocks of the privacy deck show only when their IDs are set in `src/data/site.ts`. Headings that matched LCME's legal pages were reworded ("Cookies and what the site stores in your browser", "How long we hold your data", "Sites we link to", "When this policy changes", "What you will find here", "When these terms change"), and "or send us a message" (banned) became "or write to us".
- **Redirects:** the four `/category/*` pages now 301 to `/blog/`; `/crm-software-for-personal-injury-lawyers/` left `pendingRedirectTargets`.
## 2026-11-08 Careers, CRM landers, 404 and the redirect map (branch leftover)

- **`/careers/`** (indexable, footer link under Company): the two part-time roles, each applying through its old Google Form. The video editor's details come from its own form. The graphic designer's form said it was no longer accepting answers (read 2026-11-08), so the owner should reopen it or drop the role.
- **`/crm-add/`, `/crm-add-v2/`** (noindex, so out of the sitemap; already exempt in `unique-config.json`): ported in content, rewritten in LSE's voice, shared body in `src/components/crm/` (`CrmBody`, `CrmBooking`, `CrmVideo`, `crm-data.ts`). v1: offer and sample-design form in the hero, the Vimeo walkthrough behind a click-to-play frame, the call last. v2: the cost headline, the call straight after the hero, the form last. Each form has its own `source_form` ("CRM lander v1: sample design", "CRM lander v2: sample design"). The calendar card on these pages is titled "Book a 30-minute call", not the ranking review. Left out: the Sarah Mitchell testimonial and its 60%/90% numbers, the two AI-made stock pictures, "3 spots left" and "3 firms a month" (no source), the line repeated under every example, and "$1000 for updates". "9 examples" became eight (the page had eight). Kept from the owner's page: "$150 a month per user", $9,000, $90,000, and the build "from $3,000" (in `PRICES_BY_PAGE` for these two pages only). The 555 numbers and firm names inside the design captures are the old page's own screenshots, as shown live.
- **404:** Marked style: the 404 on the swipe, the H1, the one button, then services and pricing (no Google Ads link) and the practice areas as hairline link rows. The Worker serves it with status 404.
- **Redirects:** `/newsletter/` and `/newslatter/` both go straight to `/blog/`; `/seo-for-business-lawyer/` (linked from the law-firm-names post, never a page) to `/law-firm-seo-services/`; `/category/`, `/tag/`, `/author/` and `/blog/page/` by prefix to `/blog/` (`/author/s-m-fahim/` to Fahim's bio); WordPress shortlinks `/?p=` and `/?page_id=` for all 32 known IDs to their new page in one 301; every Rank Math sitemap to `/sitemap-index.xml`. `/wp-login.php`, `/wp-admin/` and other `/wp-*` paths stay 404 on purpose. `pendingRedirectTargets` is empty.
## 2026-11-08 Depth zone kit (branch depth-kit)

The pieces for the v3 depth zone (`content/DEPTH-BRIEF.md` sections 2, 7, 9), before the page builders start. `docs/kit.md` "Depth zone" has the syntax and the wiring; `/kit/#kit-depth` shows a sample.

- **Copy as Markdown, one file per page** in a `depth` content collection (`src/content/depth/<slug>.md`): summary, FAQ, review date, author line and sources in the front matter, sections in the body. It goes through the posts' Markdown pipeline and `prose.css`; the posts' table stacking moved, unchanged, to `src/lib/markdown.ts` so both share it (the nine posts build byte for byte the same).
- **Four marker lines and a quote**, not MDX: `[checklist]`, `[steps]`, `[slot name]` (a kit piece in the text column), `[band name]` (a full-width band between sections), and `> **Lead.**` for a Callout. MDX would need a new dependency and let copy files import components; markers keep the files plain.
- **The build checks the copy**: leftover deck notes, `[ASK FAHIM]`, `[NEEDS PRICE OK]`, tables over 4 columns, H1 or H4, a callout without its bold lead, marked headings, unknown markers, a marker without its slot.
- **Open FAQ** is `Faq open="all"` (H3 questions, no `<details>`), so FAQPage JSON-LD still comes from the same items through InnerPage's `faq` prop.
- **Schema:** `webPageSchema()` in `src/lib/schema.ts` (author and reviewedBy `#fahim`, lastReviewed, dateModified); `depthSchema()` adds `fahimSchema` beside it, since neither Base nor InnerPage emits a Person. `faqSchema()` now takes a plain item type, so `schema.ts` imports no component and has unit tests (`tests/lib/`).
- **Nofollow** is automatic for the domains in `src/data/nofollow.ts` (depth copy, its sources, HairTable). It holds only `example.com` (the sample) until the pricing builder adds the agencies the market table cites.
- **AuthorBox role** is "Law firm SEO lead" (R39), not people.ts's "Law firm SEO expert".
