# QA report: lawyerseoexpert.com rebuild

Date: 2026-11-08. Branch `qa`, from `rebuild` at a0f40d0. This is a report only: no site code was changed.

**Method**
- **Build:** `npm run build` passed (check-dist and check-unique OK, with 23 uniqueness warnings).
- **Server:** the real Worker ran locally (`tests/e2e/serve.mjs` on port 8795, outside traffic blanked). Playwright Chromium used one worker, with every non-localhost host blocked at DNS, so Calendly and Turnstile never loaded.
- **Scope:** all 36 built pages from `dist/` (33 indexable plus `/kit/`, `/variants/` and `/thank-you/`), each at 1440×900 and 390×844, scrolled to the bottom so lazy content loaded.
- **Checks:** axe-core 4.14 on every page at both widths. DOM checks for overflow, headings, marks, CTAs, forms, links and JSON-LD. Every internal link target was fetched through the Worker.
- **Visual review:** two reviewers read contact sheets of all 72 full-page captures.
- **Forms:** no form was submitted. The error state was triggered by typing and blurring, and no POST was sent.
- **Evidence:** crops are in `docs/qa-shots/`. The full-page captures and raw JSON stay in `test-results/qa/`, which git ignores. They can be regenerated with `node test-results/qa/audit.mjs` and `perf.mjs`.

## Summary

| Severity | Count |
|---|---|
| Blocker | 2 |
| Major | 8 |
| Minor | 22 |
| Launch gates (expected now, must change at launch) | 4 |

**Passed with no findings:**
- **Copy rules:**
  - No em dashes, middle dots or "→" links in visible text.
  - No all-caps text or `text-transform: uppercase` anywhere.
  - No eyebrows on live pages (only on `/variants/`, which is noindex).
  - No two buttons side by side.
  - No price in any hero except `/seo-pricing/` and `/lawyer-web-design-development/`.
  - Google Ads, PPC or paid search appear only on `/law-firm-ppc/` (plus the footer link).
  - The CTA label is "Book a ranking review" on every page, and every form submit says "Send to Fahim".
  - No hatched placeholders outside privacy and terms.
- **Rendering:** no page-level horizontal scroll at either width. No JS errors (the only console errors are the blocked Calendly and Turnstile requests). No broken images. No image is upscaled past its natural width except one (Minor 21).
- **Links:**
  - All 33 internal link targets return 200, and nothing links to `/intake`.
  - The footer is identical on all 36 pages, and the header nav is identical.
  - The sitemap lists exactly the 33 indexable pages and leaves out `/kit/`, `/variants/` and `/thank-you/`.
  - `robots.txt` is fine, and the legacy redirects are one hop each.
- **SEO tags:**
  - Every page has one H1, no skipped heading levels, a self-referencing canonical, and `og:title`, `og:description`, `og:image`, `og:url` and `og:type`.
  - Every JSON-LD block parses.
  - FAQPage is used only where the FAQ is visible, and its questions match the visible ones on all 21 pages that have it.
  - Titles are unique and 60 characters or fewer except one (Minor 1). Metas are unique and 155 or fewer.
- **Phone menu:** it opens (`aria-expanded="true"`), and every link sits in view with tap targets of 57 to 65 px. Escape closes it and returns focus to the toggle.
- **Focus:** every one of the first 12 tab stops on every page shows a 3 px black outline plus the marker ring.
- **Forms:** every field is labelled and required where it should be. Each has `aria-describedby` error text, `aria-invalid` and a `role="alert"` box. The `source_form` labels are unique across the site.

The focus rings the visual reviewers saw in some captures came from my own keyboard test, which ran before the screenshot. They are not a site bug.

---

## Blocker

### B1. Unconfirmed price figures on `/`, `/seo-pricing/` (hero) and `/law-firm-seo-services/`
- **Issue:** The "hired one by one" breakdown shows these figures:
  - $1,200+
  - $1,000+
  - $750+
  - $500+
  - $125+
  - $300+
  - $150+
  - a struck "$4,000+ a month"

  None of them is in `research/FACTS.md`. `content/V2-COPY-BRIEF.md` says they are "values awaiting the owner's confirmation". CLAUDE.md rule 10 allows only the approved prices. check-dist passes only because the figures are listed in `PRICES_BY_PAGE`.
- **Evidence:** `docs/qa-shots/pricing-monthly-number-1440.png`. The figures also appear in the text of `/` and `/law-firm-seo-services/` ("Hired one by one: $4,000+ a month").
- **Fix:** Get the owner's written OK on each figure and add them to FACTS section 1, or remove the breakdown and keep only "from $2,000 a month".

### B2. Proof screenshots are unreadable on phones (owner rule: "screenshots small enough to squint at are a failure")
- **Issue:** At 390 px, 17 captures are shown at 20% to 40% of their natural width. Their text renders at about 3 to 6 CSS px. Only the tags and marks can be read. The worst cases (natural width → rendered width) are listed below.

| Capture | Natural → rendered (scale) | Pages |
|---|---|---|
| `lse-serp-lawyer-seo-expert-2026-11-08.webp` | 1800 → 356 (0.20) | home |
| `nola-site-home-desktop.webp` | 1440 → 309 (0.21) | web design |
| `elpaso-site-mobile.webp` | 824 → 196 (0.24) | home, web design, PI |
| `lse-serp-tall-*-phone-2026-11-08.webp` | 1500 → 356 (0.24) | consultant |
| `elpaso-ai-deadline.webp` | 1400 → 356 (0.25) | home, web design, DUI, med mal, PI |
| `nola-site-car-accident-page.webp` | 1440 → 356 (0.25) | services, web design, IP |
| `breakthrough-traffic.webp` | 1400 → 356 (0.25) | about/sm-fahim |
| `elpaso-calls-after.webp` | 1347 → 356 (0.26) | home, about, josh, fahim, consultant, criminal, PI |
| `elpaso-calls-before.webp` | 1200 → 356 (0.30) | home, about, criminal, PI |
| `nola-calls-jun-oct-2026.webp` | 1077 → 356 (0.33) | home, josh, fahim, DUI, employment, environmental, family, PI |
| `new-profile-calls.webp` | 1067 → 356 (0.33) | home, DUI, PI, pricing |
| `nola-jackknife.webp` | 1022 → 356 (0.35) | home, about, fahim, family, PI |

- **Evidence:**
  - `docs/qa-shots/medmal-proof-390.png`: the AI Overview body text is about 5 px.
  - `docs/qa-shots/home-elpaso-ai-390.png`
  - `docs/qa-shots/home-own-serp-390.png`: the snippet is about 6 px, and there is a blank white band under the result inside the image.
  - `docs/qa-shots/web-proof-390.png`: on `/lawyer-web-design-development/` the "#3" and "Source #1" captures also run edge to edge, with no gutter and the tag at the screen edge.
- **Fix:** Use phone crops, as `/seo-pricing/` already does with `nola-calls-total-phone.webp` (scale 0.68):
  - Make a phone crop for each capture, tight around the marked line and at least about 50% scale.
  - Serve it with `<picture media="(max-width: 640px)">` or the `Shot` `crop` prop.
  - Restore the page gutter on the web design proof frames.
- **Status: Fixed** (branch `fix-qa`). `Shot` takes an additive `phone` list: under 760px each wide capture is swapped for plain rectangle windows on the same file (same pixels, marks unchanged), and `shot()` picks the window set from the marks drawn. Every capture in the table now shows its marked line at about 11 to 16 CSS px at 390 (measured: 10.5 to 16.8px on the marked line). Phone frames get 300px on phones (site text at about 11px), the web design hero stacks its desktop and phone captures, its ranking captures have their gutter back, and the stack hero's fog panel runs to the screen edges on phones. Desktop is unchanged. Still small on phones, with no text marked: the new-profile chart's month labels (its marks sit on two points; `NumPair` says 1 → 9 beside it) and the environmental hero's unmarked chart line under its readable summary. Re-shot at 390 in `docs/shots/`.

---

## Major

### M1. The homepage H1 and meta don't target "lawyer seo expert", and the meta leads with the services page's term
- **Page:** `/`
- **Issue:**
  - The H1 is "Get found first for the cases you want.", with no keyword. `research/KEYWORD-MAP.md` section 6 gives the homepage the H1 "Lawyer SEO expert for firms that…".
  - The meta opens with "Law firm SEO that puts you at the top…". "Law firm SEO" is the primary term of `/law-firm-seo-services/` (cannibalisation note 2).
  - Both pages also share the same angle: home is "Get Found First, Get More Calls" and services is "Law firm SEO services that turn searches into calls."
- **Evidence:** `document.title` = "Lawyer SEO Expert | Get Found First, Get More Calls". `h1` = "Get found first for the cases you want." `meta[name=description]` starts "Law firm SEO…". Screenshot: `docs/qa-shots/home-hero-1440.png`.
- **Fix:** Put "lawyer SEO expert" in the H1 (for example "Lawyer SEO expert for firms that want to be found first.") and open the meta with "Lawyer SEO expert…". Keep "law firm SEO" and "services" phrasing for `/law-firm-seo-services/`. The consultant page is clean: no "expert" in its H1 or title, and it links back with the anchor "lawyer SEO expert".

### M2. Key pages get no internal links from body content
- **Pages:** `/`, `/law-firm-seo-consultant/`, `/contact-us/`
- **Issue:**
  - The homepage body links only to the practice pages, `/lawyer-web-design-development/` and privacy. It has no body link to `/law-firm-seo-services/`, `/seo-pricing/`, `/law-firm-seo-consultant/` or the about pages.
  - The keyword map requires one homepage link with the anchor "law firm SEO consultant", and "three lines and a link" to services.
  - Site-wide, `/law-firm-seo-consultant/` and `/contact-us/` get no body links at all, only header or footer links. `/law-firm-ppc/` and `/terms-and-conditions/` are footer-only too, which is fine by design.
- **Evidence:** Inbound body-link counts: consultant 0, contact 0, ppc 0, terms 0, services 15, pricing 15. Raw data is in `test-results/qa/results.json` under `links`.
- **Fix:**
  - Add a body link from home to `/law-firm-seo-consultant/` (anchor "law firm SEO consultant"), plus links to `/law-firm-seo-services/` from the "One monthly price covers everything" section and to `/seo-pricing/` from the price band.
  - Link `/contact-us/` from the about pages or the FinalCta "Prefer to put it in writing?" line.

### M3. Layout shift on the bankruptcy hero is "poor" (CLS 0.107 to 0.122 at 1440)
- **Page:** `/seo-for-bankruptcy-lawyers/`
- **Issue:** The big "43" counts up (`data-count`). While it does, `.bk-hero__num` changes width from 263 to 147 px and back, which resizes `.bk-hero__fig` and `.lse-shot__frame` next to it. Every other page measured under 0.002.
- **Evidence:** Three runs measured 0.1217, 0.1217 and 0.1070. Sources: `DIV.bk-hero__num 263x195->147x195`, `DIV.lse-shot__frame 933x338->1049x373`. Screenshot: `docs/qa-shots/bankruptcy-hero-1440.png`.
- **Fix:** Give the number a fixed width (`font-variant-numeric: tabular-nums; min-width: 2ch`), or a fixed grid column for `.bk-hero__num`, or skip the count-up above the fold.

### M4. Tables are cut off on phones and can't be scrolled with the keyboard
- **Pages:** `/lawyer-domain-names/`, `/privacy-policy/`
- **Issue:** At 390 the tables sit in scroll boxes with no cue that they scroll:
  - On the domain-names table, the "Watch out for" column is cut mid-word ("Good nam…", "clients mis…").
  - On the privacy cookie table, "What it is for" and "How long" are hidden.

  axe reports `scrollable-region-focusable` (serious) on both, because a keyboard user can't reach the hidden columns.
- **Evidence:** domain-names table `scrollWidth` 422 vs `clientWidth` 358, and the privacy table 704 vs 358. Screenshots: `docs/qa-shots/domain-names-table-390.png`, `docs/qa-shots/privacy-cookie-table-390.png`.
- **Fix:** Stack each row as a block under 640 px (label: value), or give the scroll wrapper `tabindex="0"`, `role="region"`, an `aria-label` and a visible edge fade or scroll hint.

### M5. The DUI hero's "9 calls" tag sits on a chart whose headline number is 22
- **Page:** `/seo-for-dui-attorneys/`
- **Issue:** The tag says "9 calls", but the biggest number in the capture is "22" (calls Jun to Oct). The 9 is the October point, and the caption explains it. At a glance the two numbers clash, and the El Paso result elsewhere is also "9 calls" (in six months), which adds to the confusion. The numbers are true per FACTS section 4; the framing reads wrong.
- **Evidence:** `docs/qa-shots/dui-hero-1440.png`.
- **Fix:** Change the tag to "9 in October" or "1 → 9", or mark the 22, or use a crop around the July and October points.

### M6. A blog post says "signed matters" (owner rule: "qualified leads, never signed cases")
- **Page:** `/crm-software-for-personal-injury-lawyers/`
- **Evidence:** "Your CRM shows which of those effects turns into signed matters."
- **Fix:** Rewrite it, for example "…which of those effects turns into qualified leads and retained clients." The FAQ line "Retained. The fee agreement is signed." describes a CRM stage and is fine.

### M7. Contrast fail on the "before" numbers on Fahim's bio
- **Page:** `/about/sm-fahim/`
- **Issue:** The grey "was" numbers (`.fa-pair .lse-num--was`, `#9A9E96` on white) measure 2.72:1. That is below 3:1 even for large text. axe flags it as `color-contrast` (serious) at both widths, although the element is `aria-hidden`.
- **Evidence:** `docs/qa-shots/fahim-numpair-1440.png` ($900K beside $2.7M).
- **Fix:** Use `--muted` (`#5D6159`, 6.3:1) or at least `#80847C` (about 3.9:1) for `.lse-num--was`. The same class may be used elsewhere, so check `NumPair`.

### M8. The practice pages read like one template because they reuse the same proof
- **Pages:** employment, estate planning, immigration, IP, environmental, family, criminal
- **Issue:**
  - Four practice heroes (employment, estate, immigration, IP) lead with the same New Orleans truck and tanker captures.
  - Employment and environmental both carry the same "139 calls" chart.
  - All seven end with the same block: an H2, one button, "Prefer to put it in writing?" with a form, then "More practice areas".
  - The middle sections do differ.

  BUILDER-BRIEF says pages in a group "must not look like one template with words swapped".
- **Evidence:** contact sheets `test-results/qa/sheets/seo-for-*-1440-s0.jpg`, and `docs/qa-shots/ip-hero-1440.png`, `employment-proof-390.png`, `estate-proof-390.png`.
- **Fix:** Rotate the hero proof per page from the pool in `src/data/proof.ts`:
  - El Paso deadline AI for med mal or immigration
  - the new-profile chart for estate
  - the 43-calls month for bankruptcy only
  - the El Paso before/after for criminal

  Give each page one practice-specific visual (a typed query in `SearchBox` for that practice) above the borrowed PI result.

---

## Minor

1. **`/pi-settlement-and-attorney-fee-calculator/`: title is 61 characters.**
   - Evidence: "PI Settlement and Attorney Fee Calculator | Lawyer SEO Expert".
   - Fix: drop the brand suffix or shorten it to "PI Settlement and Attorney Fee Calculator | LSE".
2. **27 pages have no `twitter:card`.**
   - Only the nine posts (calculator included) have one.
   - Fix: add `summary_large_image` in `Seo.astro` for every page.
3. **Every page shares `og-default.png`, including the Article `image` on the posts.**
   - Social shares all look identical.
   - Fix: make per-page OG images for at least home, services, pricing, consultant and the posts.
4. **No `<form>` has an `id`.**
   - The field ids are unique (`h-site`, `price-hero-email`…).
   - The `source_form` naming is mixed: "Homepage hero form", "Contact page message", "Blog: law-firm-names", "pi-hero", "about-final". This makes lead reports and GA4 harder to read.
   - Fix: set `id={idPrefix + '-form'}` in `LeadForm`, and use one `source_form` scheme (for example `page-position`).
5. **Phone captures cut mid-word on the right.**
   - Pages: `/law-firm-seo-consultant/` (`nola-wtd-ai-left-phone.webp`) and `/law-firm-seo-services/` (`nola-jackknife-left-phone.webp`).
   - Text stops mid-word ("Cueri…", "if your inju…"), so it reads as a broken image.
   - Evidence: `docs/qa-shots/consultant-wtd-crop-390.png`, `services-jackknife-crop-390.png`.
   - Fix: crop at a column boundary, or add a soft right-edge fade so the cut looks deliberate.
   - **Status: Fixed.** Both crops (and the services hero's rank crop) get a soft right edge on phones (`fadeRight()`), and every new phone window that cuts a line has one too.
6. **"5.0 stars from 317 reviews" is not in FACTS.**
   - Pages: `/law-firm-seo-services/`, `/seo-for-medical-malpractice-lawyer/`.
   - It is visible in the key-firm capture, but review counts change.
   - Fix: add it to FACTS section 4 with the capture date, or drop the number from the copy and let the screenshot carry it.
7. **An unsourced number in a guide.**
   - Page: `/criminal-defense-seo-guide/`, "A page like this is usually between 900 and 1,500 words."
   - Fix: cite a source or soften it ("long enough to answer every question").
8. **Example brackets read as unfilled placeholders.**
   - Examples: "[charge] lawyer in [county]" (criminal, DUI), "dui lawyer [city]" and "[state] license hearing" (DUI table), "[Surname] Law, PLLC" (law-firm-names), "[case type] in [state]" (social post ideas).
   - Fix: use real-looking examples ("dui lawyer Tampa"), or style the variables visibly (italic or marker) so they read as variables.
9. **A live mailto link to an example address.**
   - Page: `/law-firm-names/`, `mailto:name@harlanpikelaw.com`.
   - If that domain exists, it is a real firm.
   - Fix: render it as plain text or `<code>`, not a link.
10. **`/thank-you/` looks unfinished.**
    - It has the heading "Thank you" with no full stop (every other heading has one), one tight line under it, no next step, and the title "Thank you" (9 characters).
    - Evidence: `docs/qa-shots/thank-you-1440.png`.
    - Fix: add spacing, the reply line ("Fahim answers within an hour in business hours."), a link back to a useful page, and the brand in the title.
11. **When Calendly is blocked, the embed shows a 6×7 empty grid with "The booking calendar is on its way." indefinitely.**
    - Pages: contact, consultant, pricing, criminal, family, employment, immigration, IP.
    - A fallback link is present, which is good.
    - Ad blockers and privacy browsers will hit this, and on criminal, consultant and family it is the first action on the page.
    - Evidence: `docs/qa-shots/consultant-booking-1440.png`.
    - Fix: after about 6 s with no `calendly.event_type_viewed`, swap the grid for a short message plus the form or the link.
12. **The first action sits low on some practice pages.**
    - The rule is met: the form or Calendly is in the section straight after the hero.
    - But on these pages it starts more than a viewport down (top of the first form or embed, desktop/phone):

      | Page | Desktop | Phone |
      |---|---|---|
      | Criminal | 1750 px | 1637 px |
      | Immigration | 1867 px | 1595 px |
      | Bankruptcy | 1417 px | 1790 px |
      | Consultant | 1068 px | 1445 px |
      | IP | 897 px | 1296 px |

    - Practice pages are also inconsistent: PI, DUI, estate, med mal and environmental have the form in the hero.
    - Fix: decide one pattern per page type. For the Calendly pages, add the compact form to the hero.
13. **The homepage's own-ranking capture has a blank band.**
    - `lse-serp-lawyer-seo-expert-2026-11-08.webp` has a large empty white band under the result, inside the image.
    - Evidence: `docs/qa-shots/home-own-serp-390.png`.
    - Fix: crop the image to the result.
    - **Status: Fixed.** The `result` band now stops under the sitelinks (43.6% instead of 46%), and the phone window is cut to the result.
14. **The `#fahim` Person entity disagrees with itself.**
    - Its `jobTitle` is "SEO specialist" site-wide but "Law firm SEO expert" on `/about/sm-fahim/`, under the same `@id`.
    - The org's `sameAs` (LinkedIn company, Facebook, Instagram) are not in FACTS and were not verified.
    - Fix: use one `jobTitle`, and confirm that each `sameAs` URL exists before launch.
15. **A stranded line on Fahim's bio.**
    - Page: `/about/sm-fahim/`, "For a law firm in Denver, Fahim built a client portal and intake…".
    - It stands alone with no heading or visual and reads like a leftover caption.
    - Fix: fold it into the record list, or give it a row heading.
16. **The contact hero repeats itself.**
    - Page: `/contact-us/`. "Fahim answers within an hour in business hours." appears next to the photo, and "You get an answer within an hour in business hours." appears in "After you send it".
    - Evidence: `docs/qa-shots/contact-hero-1440.png`.
    - Fix: keep one of them.
17. **Blog breadcrumbs wrap badly on phones.**
    - On the posts at 390, the breadcrumb wraps with a "/" at the start of the second line.
    - Fix: put the separator in `::before` of the next item with `white-space: nowrap` per item, or truncate the last crumb.
18. **The struck "$4,000+ a month" wraps on phones.**
    - Pages: home, services and pricing at 390. It wraps onto its own line, and the strike runs slightly past the text.
    - Fix: `white-space: nowrap` on the struck span.
19. **`/kit/` and `/variants/` ship to production.**
    - Both are noindex and unlinked.
    - `/variants/` carries the homepage H1 and an LCME-similar 2.25% six-gram share, with eyebrows ("Direction B: Evergreen") and an axe `landmark-unique` issue.
    - Fix: leave them out of the production build, or have the Worker answer 404 for them when `LIVE` is true.
20. **The only image over 200 KB.**
    - `lse-serp-lawyer-seo-expert-tall-2026-11-08.webp` is 251 KB. It is lazy and below the fold on `/law-firm-seo-consultant/`.
    - Fix: re-encode it at q70 or crop it (target under 120 KB).
    - **Status: Fixed in part.** Re-encoded at q70: 251 KB to 194 KB, so no image is over 200 KB. Under 120 KB would need a downscale or a new crop of the source, which changes the marks and crops: left for a recapture (the capture also still shows the old title). Phones never load it (they get the 48 KB and 16 KB phone crops).
21. **A capture is shown past its natural width.**
    - Pages: `/law-firm-seo-services/` and `/seo-for-employment-lawyers/`. `nola-wtd-rank.webp` is shown at 976 px, which is wider than its natural 900 px.
    - Fix: cap it with `max-width: 900px` (the `Shot` rule: never larger than natural width).
22. **Stale notes in the repo.**
    - `src/data/redirects.ts` says "PLAN.md section 9: no PPC page", but `/law-firm-ppc/` exists.
    - CLAUDE.md rule 10 lists only the $2,000 prices, but FACTS section 1 approves "from $500 a month" for PPC.
    - Fix: update both so the next builder isn't misled.

---

## Launch gates (expected on the Preview, must change for launch)

- **G1. `X-Robots-Tag: noindex` on every response.** It is on every HTML page, `robots.txt`, the sitemap and the feed, because `LIVE` is `"false"` in `wrangler.jsonc` (`worker/router.ts:103`). This is correct for the Preview. Launch needs `LIVE: "true"`, then a re-check with `npm run verify-live`.
- **G2. `/newslatter/` redirects to `/newsletter/`, which returns 404.** `pendingRedirectTargets` still lists `/newsletter/`. Build the page, or point the redirect at `/blog/` or `/`.
- **G3. Placeholders on privacy and terms.**
  - `/privacy-policy/` shows 10 and `/terms-and-conditions/` shows 8 (entity name, address, retention, governing law, and others).
  - They are allowed now. Launch needs them filled (check-dist warns).
  - Their placeholder text is 12.3 to 13.9 px, under the 15 px meta minimum.
- **G4. The production route is still commented out in `wrangler.jsonc`.** It needs the owner's OK (CLAUDE.md rule 1).

---

## Performance (homepage, money page, practice page, post)

Measured with Playwright performance APIs against the local Worker:
- **Desktop:** 1440 px, DPR 1, unthrottled.
- **Phone:** 390 px, DPR 2, slow-4G emulation (150 ms RTT, 1.6 Mbps) and 4× CPU.

Absolute times on this shared PC are unreliable. Quiet runs gave the times below, but random stalls of 4 to 8 s hit every page now and then (the PI page measured 4.8 s once). curl showed a TTFB of 10 to 140 ms and the stalls could not be reproduced, so treat the LCP element and the weights as the findings and re-measure times on the Preview with PageSpeed Insights.

| Page | LCP element (desktop / phone) | LCP quiet run (desktop / throttled phone) | Transfer (desktop / phone) | Render-blocking |
|---|---|---|---|---|
| `/` | `img.lse-shot__img` nola-calls-jun-oct-2026.webp (eager, `fetchpriority=high`), H1 just before it | 144–216 ms / 1.37 s | 487 KB (424 KB images) / 242 KB | `Base.css` 3 KB, `index.css` 2 KB |
| `/law-firm-seo-services/` | H1 / H1 | 240 ms / 1.24 s | 413 KB / 135 KB | `Base.css` 3 KB |
| `/seo-for-personal-injury-lawyers/` | img nola-key-firm.webp (eager, high) / H1 | 196–228 ms / about 1.3 s | 350 KB / 130 KB | `Base.css` 3 KB |
| `/law-firm-names/` (post) | H1 / first paragraph | 116 ms / 1.10 s | 129 KB / 129 KB | `Base.css` 3 KB, `_slug_.css` 2 KB |

What would affect Core Web Vitals:
- **CLS:** bankruptcy only (M3). All other pages measured 0.000 to 0.0011.
- **LCP:** healthy. HTML is 26 KB gzipped (79 KB raw), inline CSS is 7 to 18 KB, the font is preloaded and 24 KB, and JS is 7 KB.
  - `/law-firm-seo-services/` marks two hero images `fetchpriority=high` (`nola-wtd-query`, `nola-wtd-rank`). Keep only the LCP one high.
  - The homepage loads its four trust logos eagerly. They are tiny, but `loading="lazy"` on phones costs nothing.
- **Image weights:** one file over 200 KB (Minor 20). The next largest are `elpaso-ai-deadline.webp` at 125 KB, the two `nola-site-*` captures at 124 KB, and `nola-wtd-ai.webp` at 111 KB. Phone crops from B2 would also cut phone transfer.

## Accessibility

- **axe:** run on all 36 pages at both widths. It found only M4 (`scrollable-region-focusable`), M7 (`color-contrast`) and `/variants/` (`landmark-unique`). Contrast was "incomplete" on up to 25 nodes per page, where marks blend over images, so those were checked by hand.
- **Highlighter:** `.lse-mk` is black on `#D4F04A`, which measures 16.9:1. Marks on screenshots use `mix-blend-mode: multiply`, so the text under them stays dark. The one weak spot is the September mark on the blue label in `nola-calls-jun-oct-2026.webp`, already noted in `proof.ts`.
- **Focus:** a 3 px black outline plus a 6 to 7 px marker ring, visible on links, buttons and inputs on every page.
- **Small text:** the form privacy line ("We use your details…" and its "Privacy policy" link) is 13.5 px on every page with a form, under the 15 px meta minimum in `design-system.md`. Raise it to 15 px.
- **Error states:** verified on the PI hero form without submitting. An invalid email gets `aria-invalid="true"` and the message "That email address does not look right." Website and name have their messages ready. No POST was sent (`docs/qa-shots/pi-hero-form-error-390.png`).

## Facts spot-check (FACTS.md sections 1 to 4)

- **Matched:**
  - 139 calls, up 39%, 43 in September, 22 on the new profile (1 → 9), 9 → 23 for El Paso.
  - 16 hours, always with "about three months of groundwork". #1 and #3 ranks, used as FACTS allows.
  - Fahim: 6.5 years, 67+ businesses, 200+ websites, 4 countries, 150k+ keywords, 50+ ranked, $36M+, $100M+, $34M, $900K → $2.7M in 10 months (2021), Breakthrough Maths near zero → 19K, RUET, NASA 2017.
  - Josh: 2008, more than 50 firms, JD Texas Tech, BA UNM.
  - Prices: $2,000 for SEO and web, $500 for PPC (FACTS section 1).
- **Not in FACTS:**
  - the price breakdown (B1)
  - "5.0 stars from 317 reviews" (Minor 6)
  - "900 to 1,500 words" (Minor 7)
- **Out of scope:** the calculator's example sums are worked examples. Web standards figures in the posts (2.5 s, 200 ms, 0.1) are cited to web.dev.

## Keyword map check (titles and H1s)

All 11 practice pages, the services, consultant, pricing and web design pages carry their primary query in the title and H1. Some use a close variant, for example "Employment lawyer SEO" in the H1 and "SEO for Employment Lawyers" in the title. The homepage is the exception (M1). Cannibalisation between the three pages:
- **Consultant page:** clean. No "expert" in its H1 or title, and it links back with "lawyer SEO expert".
- **Homepage:** clean in the H1, title and first 100 words. "advisor" appears once in Josh's bio.
- **Missing pieces:** the homepage-to-consultant link (M2), and the homepage's own keyword in the H1 and meta (M1).
