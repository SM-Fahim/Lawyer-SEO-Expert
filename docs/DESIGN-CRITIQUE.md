# LSE design critique, 8 November 2026

Built site: `site/dist` from rebuild d738c9e. Bankruptcy, immigration and medical malpractice are still the older v2 there; they are critiqued as built, and their notes should go to the builder finishing them.

Screens: first screens at 1440x900 and 390x844 are in `critique-shots/` (`lse-<slug>-1440.png`, `lse-<slug>-390.png`, LCME as `lcme-<slug>-*.png`). Calendar and dialog states are `cal-*` and `dialog-*`. The full-page shots are the builders' own in `shots/<slug>-1440.png` and `-390.png`. All Calendly traffic was blocked or held open on purpose, so no request reached Calendly and nothing was booked.

The bar used throughout: the homepage hero ([lse-home-1440](critique-shots/lse-home-1440.png), [lse-home-390](critique-shots/lse-home-390.png)), which the owner calls "okay, not bad". In its first screen it has a 2-line H1, a 3-line lead, the form on the left, one big chart on the right with one tag, a 2-line caption, and the logos just below. On a phone it shows H1, lead, one compact proof crop, then the form.

---

## 1. Top 10 problems, ranked by lead impact

| # | Problem | Where | Why it costs leads | Fix (detail in the sections below) |
|---|---|---|---|---|
| 1 | The form asks about rankings, not about results or cost. "Where does your firm show up today?", "Can a driver in your county find you?", "Which planning questions do you rank for?", "Where does your firm show up for these?". The button says "Send to Fahim" | SEO services, DUI, estate planning, bankruptcy hero forms; every `LeadForm` button. [services](critique-shots/lse-law-firm-seo-services-1440.png), [DUI](critique-shots/lse-seo-for-dui-attorneys-1440.png), [estate](critique-shots/lse-seo-for-estate-planning-lawyers-1440.png) | A firm owner wants to know what is possible for the firm and what it costs. A question about where they show up sounds like homework and promises nothing they want. The button names who gets the note, not what they get back | One form promise sitewide: the plan and the monthly price in writing, with a reply within an hour. See section 3 |
| 2 | The calendar looks broken while it loads. No skeleton in the dialog, passive wording ("The booking calendar is on its way."), and the "Use the calendar on Calendly instead" link runs on a 6 s CSS timer from page load. So on a calendar far down a page, the link is already showing before anything starts loading | `CalendlyInline.astro`, `calendly.ts`, `BookingDialog.astro`. [family band after 10 s of reading](critique-shots/cal-family-lazy-after-reading-1440.png), [dialog at 1 s](critique-shots/dialog-slow-1s-1440.png), [dialog at 7 s on a phone](critique-shots/dialog-slow-7s-390.png) | The moment a visitor decides to book is the worst place for doubt. A blank white panel and a "go somewhere else" link read as "this is broken". Sending them off to Calendly loses the page's tracking and the trust the page built | Skeleton and progress line in our look, active wording, a fallback counted from mount and shown at once on a blocked script. Section 4 |
| 3 | The one label "Book a ranking review" sells an activity (a review of where you rank), which is the same framing the owner just rejected | Header button, every `Button`, dialog title, every booking card head, `site.cta` | It is the most repeated words on the site and it promises a report, not an outcome. The sub-line "Fahim checks your real rankings with you" makes it worse | Change the label to one that names what the firm leaves with (section 3.3). Needs the owner's OK, because FACTS section 1 records the label as his decision |
| 4 | Cluttered heroes. The same number is repeated 3 or 4 times, a caption gets a second bold sentence under it, a paragraph fills the proof slot, and a black rule splits the hero | Consultant (23 shown three times), bankruptcy (43 shown four times), criminal and about (9 and 23 as a number pair plus two half-width charts), IP and bankruptcy (bold line under the caption), employment (a 5-line caption as the panel's left column). Section 2 | The eye has no single place to land. The owner reads clutter as template and AI design, and a skimmer doesn't reach the form | One hero standard with a hard budget (section 2.3): one proof, one tag, a one-line caption |
| 5 | No trust beside the way to act. Only PI and the homepage show the logos in the first screen. No inner hero shows Fahim's or Josh's face next to the form or the calendar | All inner heroes except PI; every booking card | The owner: "they'd prefer a call if there's enough trust and expertise." The form and the calendar sit alone, with no person and no names of firms beside them | A trust line attached to the action: Fahim's face (`Face xs`), the reply time, and the four logos under it. Section 3.2 |
| 6 | Hero proof is too small to read, or contradicts itself | Family ([1440](critique-shots/lse-seo-for-family-lawyers-1440.png)): a full results page at about 460 px wide, text about 5 px. Immigration ([390](critique-shots/lse-seo-for-immigration-lawyers-390.png)): a full results page starting at the Google header and "Sponsored Results", proof line below the fold, text about 4 px on a phone. Criminal and about: two GBP charts at half width, text about 6 px. DUI: the tag says "9 calls in October" while the capture's biggest figure is "22" | Proof you have to squint at counts as no proof (BUILDER-BRIEF says so). A tag that doesn't match the biggest number makes a careful reader doubt every number | Crop to the proof line, one capture per hero, and make the tag match the capture. Section 5 |
| 7 | The call, which the owner says firms prefer, sits in the wrong place. Pages with a hero form end with a button plus a second full form. Pages with a calendar band put it near the top, before any trust is built, and then end with the same button and form again | `FinalCta` on every page ([PI end](shots/seo-for-personal-injury-lawyers-1440.png), cropped in the notes below); booking bands on consultant, criminal, family, employment, IP, immigration | At the end of a long page, trust is highest and the visitor is ready for a call, but the page offers a button and a 4-field form with a textarea. Three ways to act stacked at the end read as pushy and templated | Make the closing section call-first: the real calendar with trust beside it, and the form as a text link. Section 3.2 and batch 5 |
| 8 | Depth zones: at 1440 the right 45% of the page is empty for 10,000 to 14,000 px. H2s are 3-line questions at 56 px, and the long middle has no proof in it | Every v3 page. [PI](shots/seo-for-personal-injury-lawyers-1440.png), [DUI](shots/seo-for-dui-attorneys-1440.png), [services](shots/law-firm-seo-services-1440.png) | It reads as a wall. The result that proves the advice (the New Orleans truck pages) is a table with no screenshot, so the page stops selling halfway down | Smaller depth H2s, real proof placed beside the worked examples, one disclaimer per page, a shorter summary block. Section 6 |
| 9 | Phones: inner heroes show H1 (4 to 5 lines), a lead (4 to 5 lines), then the form. No proof appears in the first screen, unlike the approved homepage, which puts a compact proof crop before the form | PI, DUI, estate, med mal, environmental, PPC, web design at 390. [Sheet: home vs services](critique-shots/lse-home-390.png), [PI 390](critique-shots/lse-seo-for-personal-injury-lawyers-390.png) | A phone visitor sees a wall of text and a form, and no reason to fill it in | `visualFirst` on phones with a compact crop of 220 px or less, the lead capped at 2 lines. Section 2.3 |
| 10 | The hero form is the heaviest thing on the page. A 2 px black box with a 12 px radius, a pill-shaped first field next to rectangular fields, and on SEO services and estate planning a full-width row box that pushes the proof below the fold | `LeadForm compact`, `PageHero` stack layout. [services](critique-shots/lse-law-firm-seo-services-1440.png), [estate](critique-shots/lse-seo-for-estate-planning-lawyers-1440.png) | Boxy, form-shaped heroes are the look the owner hates. The first screen reads as "fill this in", not "here is what we did" | Drop the black outline (the fields alone are enough, or use a fog panel), use one field shape, and no full-width row form in a hero |

Smaller, still worth fixing (section 7): the careers role heading has text to its right and a marker on running text that isn't proof; the blog post jump list is a `<details>` toggle; the mobile menu has no backdrop and its label never changes to "Close"; "Practice areas" in the header jumps away to the homepage; the talk line is worded two ways ("Prefer a call?" and "Rather talk it through?").

---

## 2. Hero clutter

### 2.1 How the homepage hero does it (the bar)

| Element | Homepage |
|---|---|
| H1 | 8 words, 2 lines at 86 px |
| Lead | 1 sentence, 3 lines |
| Action | Form: heading, one sub line, 3 fields, button, privacy line. Talk line under it |
| Proof | 1 chart, 1 tag ("139 calls"), 2 marks, 1 caption of 2 lines |
| Trust | Logos just under the proof |
| Phone order | H1, lead, compact proof crop, caption, form |

Count: 6 things. Every inner hero below should stay at 7 or fewer, counting the breadcrumb.

### 2.2 Page by page

"Move" means move into the first section under the hero. "Cut" means delete from the hero (the words can live in the depth zone).

| Page and shot | What the hero holds now | Keep | Move below | Cut |
|---|---|---|---|---|
| SEO services [1440](critique-shots/lse-law-firm-seo-services-1440.png) [390](critique-shots/lse-law-firm-seo-services-390.png) | Crumbs, H1, lead, full-width boxed row form (heading, sub, 3 fields, button, privacy), "Prefer a call?" line, fog block with search box and result, "#1" tag, caption | Crumbs, H1, lead, form (as a 5-column block, not a full row), proof with tag, caption | Nothing | The full-width row layout. Use split, so the #1 proof is in the first screen. The proof is readable ([crop of the hero proof](critique-shots/lse-law-firm-seo-services-1440.png)), it is just below the fold |
| SEO consultant [1440](critique-shots/lse-law-firm-seo-consultant-1440.png) [390](critique-shots/lse-law-firm-seo-consultant-390.png) | Crumbs, H1 (4 lines), lead, big "23" with label, chart with a "23 calls" tag, the chart's own "23" marked, caption, big empty space under the lead | Crumbs, H1, lead, one chart with the tag | The booking band (it already follows straight after) | The separate big "23" number: the tag says it. Or keep the number pair "9 to 23" and drop the chart. Not both |
| Pricing [1440](critique-shots/lse-seo-pricing-1440.png) [390](critique-shots/lse-seo-pricing-390.png) | Crumbs, H1 with price, lead, form, talk line, price card | All of it. This is the best inner hero | Nothing | Nothing. Only change the form words (section 3) |
| Web design [1440](critique-shots/lse-lawyer-web-design-development-1440.png) [390](critique-shots/lse-lawyer-web-design-development-390.png) | Crumbs, H1 (4 lines), lead (4 lines), form, talk line, desktop and phone frames, "New Orleans" tag, caption | Crumbs, H1, form, frames, tag, caption | "Your firm owns all of it." to the first section | Cut the lead to 2 lines |
| PPC [1440](critique-shots/lse-law-firm-ppc-1440.png) [390](critique-shots/lse-law-firm-ppc-390.png) | Crumbs, H1, lead, form with a 4th field (a "Running Google Ads now?" select), talk line, search panel, caption | Crumbs, H1, lead, 3-field form, search panel | The select, to the thank-you step or the closing form | The 4th field in the hero |
| Personal injury [1440](critique-shots/lse-seo-for-personal-injury-lawyers-1440.png) [390](critique-shots/lse-seo-for-personal-injury-lawyers-390.png) | Crumbs, H1 (4 lines), lead (4 lines), form, talk line, logos, AI card with "Key firm" tag, 2-line caption | All, as the practice-page model | Nothing | "Injury is where our results come from." Cut the lead to 2 lines |
| Criminal defense [1440](critique-shots/lse-seo-for-criminal-defense-lawyers-1440.png) [390](critique-shots/lse-seo-for-criminal-defense-lawyers-390.png) | Crumbs, H1 (3 lines, full width), lead, black rule, "9 to 23" pair, two half-width GBP charts, "23 calls" tag, caption. No action in the first screen | Crumbs, H1, lead, the "9 to 23" pair | The two charts, as one full-width "after" chart in the next section | The black rule. The "before" chart (the grey 9 already says it) |
| Family [1440](critique-shots/lse-seo-for-family-lawyers-1440.png) [390](critique-shots/lse-seo-for-family-lawyers-390.png) | Crumbs, H1 (4 lines), lead (4 lines), full results page shrunk, "Still cited a week later" tag, 2-line caption that explains it is a PI result, then a large empty area | Crumbs, H1, a cropped AI-answer capture with the tag | The calendar band up into the empty space (or a form, see the standard) | The second caption sentence ("A family law answer can hold its place the same way..."). Cut the lead to 2 lines |
| DUI [1440](critique-shots/lse-seo-for-dui-attorneys-1440.png) [390](critique-shots/lse-seo-for-dui-attorneys-390.png) | Crumbs, H1 (3 lines, full width), lead, chart with "9 calls in October" tag (the capture's big number is 22), caption, form, talk line | Crumbs, H1, lead, form, chart | Nothing | The mismatch: tag the October point ("1 to 9 a month") or crop out the "22" |
| Employment [1440](critique-shots/lse-seo-for-employment-lawyers-1440.png) [390](critique-shots/lse-seo-for-employment-lawyers-390.png) | Crumbs, H1, lead, fog panel with a 5-line caption as its left column, AI capture with "Show more" and tag | Crumbs, H1, lead, capture with tag | The calendar band follows; fine | The paragraph as a column. Make it a 1-line caption under the capture |
| Estate planning [1440](critique-shots/lse-seo-for-estate-planning-lawyers-1440.png) [390](critique-shots/lse-seo-for-estate-planning-lawyers-390.png) | Crumbs, H1 (3 lines), lead (3 lines), full-width boxed row form, talk line, proof below the fold | Crumbs, H1, lead, form | Nothing | The row layout. Same fix as SEO services, so both stop using the same stack-plus-row template |
| Bankruptcy (v2) [1440](critique-shots/lse-seo-for-bankruptcy-lawyers-1440.png) [390](critique-shots/lse-seo-for-bankruptcy-lawyers-390.png) | Crumbs, H1, lead (3 lines), black rule, big "43" with label, chart with "43 calls" tag and a "43" bubble, caption, bold line under the caption | Crumbs, H1, lead, the chart with its tag | The bold line, to the first section | The separate big "43" and the rule. 43 should show up once as the tag, and once in the chart, where Google prints it |
| Immigration (v2) [1440](critique-shots/lse-seo-for-immigration-lawyers-1440.png) [390](critique-shots/lse-seo-for-immigration-lawyers-390.png) | Crumbs, H1 (3 lines), lead (3 lines), a full results page from the Google logo down, "Cited by Google's AI" tag | Crumbs, H1, the tag | Nothing | Everything above the AI answer in the capture: crop to the AI answer and the key-firms block |
| Medical malpractice (v2) [1440](critique-shots/lse-seo-for-medical-malpractice-lawyer-1440.png) [390](critique-shots/lse-seo-for-medical-malpractice-lawyer-390.png) | Crumbs, H1 (vertically centred left), lead, form right, talk line, black rule, search box strip with "Source #1" cut by the fold | Crumbs, H1, lead, form, the proof strip | Nothing | The rule. Pull the strip up so the "#1 source" line is in the first screen |
| IP [1440](critique-shots/lse-seo-for-intellectual-property-lawyers-1440.png) [390](critique-shots/lse-seo-for-intellectual-property-lawyers-390.png) | Crumbs, H1 (4 lines), lead (5 lines), a small result card with "#3" tag, 2-line caption, a 2-line bold line ("Once the groundwork is in... not a promise.") | Crumbs, H1, result card with tag, 1-line caption | The bold line, to the first depth section on speed | Cut the lead to 2 lines |
| Environmental [1440](critique-shots/lse-seo-for-environmental-law-attorneys-1440.png) [390](critique-shots/lse-seo-for-environmental-law-attorneys-390.png) | Crumbs, H1 (3 lines), lead (4 lines), chart with "Up 39%" tag, form | Crumbs, H1, chart, form | Nothing | Cut the lead to 2 lines |
| About [1440](critique-shots/lse-about-1440.png) [390](critique-shots/lse-about-390.png) | Crumbs, H1, lead, "9 to 23" pair, two GBP charts, "23 calls" tag | Crumbs, H1, lead, one result | The charts | This is the third page with the same 9-to-23 block (criminal, consultant, about). Give about a different hero: the two people (Fahim and Josh faces) and the 139-calls result as one line |

Pages that are clean and should stay as they are: Fahim's bio ([1440](critique-shots/lse-about-sm-fahim-1440.png)), Josh's bio ([1440](critique-shots/lse-about-josh-henderson-1440.png)), contact ([1440](critique-shots/lse-contact-us-1440.png)), the blog index ([1440](critique-shots/lse-blog-1440.png)) and the post ([1440](critique-shots/lse-how-to-get-clients-as-lawyers-1440.png)).

### 2.3 One hero standard, with variants

**Superseded on 2026-11-09 (owner: "left column is full of texts, right is just an image ... the hero section does not end in the viewport").** The variants below are gone. All 16 service and practice pages use one hero, PageHero `layout="row"`: the H1 and line across, then the form in the homepage's bordered card (left) beside the proof on the fog panel with the trust row at its foot (right). See `docs/kit.md` (PageHero) and `scripts/hero-budget.mjs`. The budget items 1, 2, 3, 6 and 7 still hold; item 4's "no outline box" is replaced by the homepage's card.

**The budget (every service and practice hero):**
1. Crumbs (muted, one line).
2. H1: 10 words or fewer, 3 lines or fewer at 1440. The keyword stays in it.
3. Lead: 2 lines or fewer at 1440 (about 25 words). Extra lines go to the first section.
4. The action: the compact form (heading, one sub line, 3 fields, button). No outline box.
5. Trust, attached under the action: Fahim's face (xs), the reply line, the four logos. Always the same block, so it reads as one thing (section 3.2).
6. One proof: one capture, one tag that matches the capture, at most 2 marks.
7. One caption: 1 line, about 14 words, saying whose result it is.

Not allowed in a hero: a second capture, a separate big number that repeats the tag, a bold line under a caption, a black rule, a paragraph in the proof slot, a 4th form field, a full-width row form. On phones the order is H1, lead, the proof (a compact crop of 220 px or less, like the homepage), the form, then trust.

**Service pages (4 variants):**

| Variant | Layout | Pages |
|---|---|---|
| S1 Split | Text and form left (5), proof right (7) on the fog panel. The homepage's own shape, so use it only once | SEO services |
| S2 Flip | Proof left (7), text and form right (5) | Web design (the desktop and phone frames) |
| S3 Price-led | The price card is the proof | Pricing (as built) |
| S4 Top | H1 and lead across, then proof (7) and form (5) under them, white, no panel | PPC (the search panel), consultant (one chart) |

**Practice pages (4 variants), assigned so that no two neighbours in the nav look alike:**

| Variant | Layout and proof type | Pages |
|---|---|---|
| P1 Split, AI capture | Text and form left, a cropped AI answer or key-firms card right | PI, employment, immigration |
| P2 Top, number | H1 across, then one `NumPair` and the form side by side; the chart moves to section 1 | Criminal defense, bankruptcy, environmental |
| P3 Flip, search strip | A search box over its result left (the stacked `Shot`), form right | DUI, IP, medical malpractice |
| P4 White, no panel | Form right, proof under the H1 on white, no fog | Family, estate planning |

Pages that open with a calendar band instead of a form (consultant, criminal, family, employment, IP, immigration) should switch to the form in the hero and move the calendar to the close (section 3.2). That ends the "H1, lead, proof, then a calendar card" pattern, which is close to LCME's hero with the calendar beside it.

---

## 3. The CTA and the form

### 3.1 Form heading, sub line and button

Inside FACTS: a written monthly number before any work starts (section 1), a reply within an hour in business hours (section 1, LSE wording), "qualified leads", no promised results, no price in a hero.

| | Heading | Sub line | Button |
|---|---|---|---|
| **1 (recommended)** | What could Google bring your firm, and what would it cost? | Send your website. Within an hour in business hours, Fahim writes back with the searches worth winning in your market and your monthly price. | Get my plan and price |
| 2 | Get your growth plan and monthly price in writing. | Send your website. Fahim shows which searches bring clients to firms like yours, what it takes to win them, and what it costs. He replies within an hour in business hours. | Send my website |
| 3 | More qualified leads from Google. See what it would take. | Send your website. Fahim replies within an hour in business hours with the searches your firm can win and the price, before any work starts. | Show me what's possible |

Why 1: it is the owner's sentence turned into a heading (results, how much is possible, cost). It's a question the owner asks himself, not a question about the website. The button names what comes back. Practice pages swap one word: "What could Google bring your injury firm, and what would it cost?" Keep the heading on 2 lines at 1440 (`max-width` about 22ch).

Check before shipping: run check-unique on the new strings. LCME's "Book a free call" and "within 1 hour" are banned, and none of the three uses them.

Same change for the related strings:
- `site.cta.sub` (dialog and every booking card): from "Free, 30 minutes. Fahim checks your real rankings with you." to "Free, 30 minutes with Fahim. You leave knowing which searches can bring you clients, what it takes and what it costs."
- The form's thank-you heading "Thanks. Fahim has your note." is fine. Add "Your plan and price come by email within an hour in business hours."
- Closing H2s that ask about rankings ("See which DUI and license searches your practice wins today.", "Find out which accident searches your injury firm could win next.") should ask about calls and cost the same way: "Find out how many more injury calls are within reach, and the price." These are copy-deck lines, so the writer changes them, not the builder.

### 3.2 Lead with the form or with the call?

**Recommendation: the form leads in the hero, with trust attached. The real calendar leads at the close of the page, with trust beside it.**

Why:
- A visitor from Google has no trust yet when the hero loads. A 30-minute call is a big ask from a stranger. The owner said firms prefer a call "if there's enough trust and expertise", so the call belongs where the trust has been built: after the proof and the depth.
- The form asks for a website and returns exactly what the owner says buyers want (what's possible and the cost). It's quick on a phone and loads nothing heavy.
- A calendar in the hero means 3 MB of Calendly in the first screen (worse LCP), and the dark-hero-with-calendar-beside-it shape is LCME's, which the brief bans.
- The call stays one tap away the whole time: the header button, and the one text line under the form ("Prefer to talk? Book ..." with the new label).

What changes:
- **Trust beside the action**, in every hero: one row under the form with Fahim's face (`Face size="xs"`, our swipe, not LCME's overlapping circles), "Fahim answers within an hour in business hours." and the four logos (`TrustLine`, the small size). Then drop the reply line from the form's sub, so it shows once.
- **The close is call-first**: `FinalCta` becomes the calendar (the BookingBand split: H2, a 2-line lead, Fahim and Josh as faces with one line each, then the calendar card on the right) and keeps "Prefer to write? Send your website" as a text link to the hero form. That replaces the button plus a 4-field form with a textarea.
- **No calendar near the top** of pages that also have the hero form, so a page never offers more than two ways to act.

### 3.3 The sitewide label "Book a ranking review"

It doesn't sell an outcome. It names a check-up, and "ranking" is exactly the "where do you show up" idea the owner just turned down. It also sits on the header button on every page.

Alternatives that work as one label everywhere (header, buttons, dialog title, card head):

| Label | Reads as | Note |
|---|---|---|
| **Get your plan and price** (recommended) | What the firm leaves the call with | Matches form option 1. Fits the header button at 16 px |
| Book a growth call | An outcome-led call | Generic, and close to many agencies' wording |
| See what's possible | Upside | Doesn't say it is a call, and it's weak on a dialog title |

Avoid "Book a free call" and "Book a free strategy call": LCME uses the first, and check-unique flags it. FACTS section 1 records "Book a ranking review" as the owner's decision, so this needs his OK. After that, change `site.cta.label` and FACTS together. The dialog title becomes the label; keep "Free, 30 minutes" in the sub line.

---

## 4. The calendar loading state and the booking dialog

### 4.1 What happens now

| State | What the visitor sees | Shot |
|---|---|---|
| Booking band, script slow, 2 s | Hairline month grid (only inside `BookingBand`) and "The booking calendar is on its way." | [cal-contact-slow-2s-1440](critique-shots/cal-contact-slow-2s-1440.png), [390](critique-shots/cal-contact-slow-2s-390.png) |
| Booking band, 8 s | The same, plus "Use the calendar on Calendly instead" | [cal-contact-slow-8s-1440](critique-shots/cal-contact-slow-8s-1440.png) |
| A band far down the page, reached after 10 s of reading | The fallback link is already showing, because the 6 s CSS animation started at page load | [cal-family-lazy-after-reading-1440](critique-shots/cal-family-lazy-after-reading-1440.png), [390](critique-shots/cal-family-lazy-after-reading-390.png) |
| Dialog from the header button, 1 s | A tall blank white panel with one grey line in the middle. No grid, no motion | [dialog-slow-1s-1440](critique-shots/dialog-slow-1s-1440.png), [390](critique-shots/dialog-slow-1s-390.png) |
| Dialog, 7 s | The same, plus "Use the calendar on Calendly instead" | [dialog-slow-7s-1440](critique-shots/dialog-slow-7s-1440.png), [390](critique-shots/dialog-slow-7s-390.png) |
| Script blocked | The card shrinks to a short box: "The calendar can't load in this browser." and the link. No other way to act in the card | [cal-contact-blocked-1440](critique-shots/cal-contact-blocked-1440.png), [dialog-blocked-390](critique-shots/dialog-blocked-390.png) |
| LCME for comparison | A pulsing calendar-shaped skeleton and a line that says it is loading | [lcme-booking-slow-1s-1440](critique-shots/lcme-booking-slow-1s-1440.png), [lcme-home-1440](critique-shots/lcme-home-1440.png) |

What's wrong: nothing moves, so it looks frozen. "On its way" sounds like a delivery, not like loading. The dialog has no skeleton at all. The way out appears on a clock that has nothing to do with the calendar. And the blocked state offers only a trip to another site.

### 4.2 The fix (our look, not LCME's)

**One placeholder for every calendar.** Move the skeleton out of `BookingBand.astro` into `CalendlyInline.astro`, so the band and the dialog share it.

Look (Marked: ink, hairlines, the highlighter only as a mark):
- A **progress line**: 3 px tall across the top of the calendar body, a black bar sliding left to right in a loop (`transform: translateX`, 1.2 s, ease-in-out). With reduced motion it is a still bar at 40% width. This is the main "it's working" signal, and LCME has no such thing.
- A **calendar-shaped skeleton** under it: a month label bar (fog, 40% wide), 7 small weekday ticks, then a 7 by 5 grid of hairline cells (the current band grid, made lighter: `--line`). Days are drawn as hairline cells only, never filled, so no day looks open when it isn't. No pulsing dots (that is LCME's skeleton).
- A **time column** on wide cards (at 560 px and up): 4 hairline slot bars to the right, the way Calendly's own layout looks, so the change-over doesn't jump.
- Fahim's face (xs, on the swipe) in the card head, to the left of the title. This is the trust the owner asked for, at the point of booking.

Words:
- While loading: **"Loading Fahim's calendar."** and under it, smaller: "It takes a few seconds."
- After the delay (still loading): **"Still loading."** and the link **"Open the calendar in a new tab"**. Plus a second line: **"Or send your website and Fahim writes back within an hour in business hours."**, linking to the page's form, or to `/contact-us/` from the dialog.
- Blocked: **"Your browser blocked the calendar."** Same link and same form line, shown at once.

Behaviour (in `calendly.ts`, not CSS timers):

| Moment | State class on `.lse-cal__body` | Shows |
|---|---|---|
| Before mount (lazy, not near the screen yet) | none | Skeleton and words, no progress line, no link |
| `mountCalendar()` called | `is-loading`, and a timer starts now | Progress line, skeleton, loading words |
| 8 s after mount, still not ready | `is-slow` | "Still loading." plus the link and the form line. The skeleton stays |
| `script.onerror`, or a CSP or blocker error | `is-failed` at once | The blocked words, link and form line. Keep the card at least 320 px tall, so it doesn't collapse to a sliver |
| Calendly posts `event_type_viewed` (plus the existing 1 s) or the iframe-load fallback fires | `is-ready` | The placeholder fades out (0.25 s) |
| No JavaScript | none, `.js` missing | The link shows at once (keep the current `.js` gate) |

Code notes:
- Delete `.js .lse-cal__ph a{visibility:hidden;animation:lse-late 0s 6s forwards}` and `@keyframes lse-late`. Hide the link with `.js .lse-cal__body:not(.is-slow):not(.is-failed) .lse-cal__ph .lse-cal__out{display:none}`.
- In `mountCalendar()`: `box.classList.add('is-loading'); const t = setTimeout(() => { if (!box.classList.contains('is-ready')) box.classList.add('is-slow'); }, SLOW_MS);`, and clear the timer in `reveal()`. `SLOW_MS = 8000`: the code's own notes measure up to about 4 s on a slow phone, so 8 s is a real delay.
- The dialog calls `mountCalendar` when it opens, so its timer starts at the click. That is already right once the CSS timer is gone.
- If the dialog is closed and opened again while loading, don't restart the timer (it already has `data-mounted`).
- Announce the state for screen readers: `role="status"` on the words line. Change the text, not the node.
- Test: extend `tests/e2e` with three cases. Script held open: progress line at 1 s, no link at 5 s, link at 9 s. Script aborted: blocked words and link at once. Dialog opened 10 s after load: no link at 1 s.

### 4.3 The booking card heading

Inside a booking band, the card repeats a heading and sub under the band's own H2 and lead ("Put 30 minutes with Fahim in your calendar." then "Book a ranking review" then "Free, 30 minutes. Fahim checks your real rankings with you."). See [the IP band in the full shot](shots/seo-for-intellectual-property-lawyers-1440.png). Add a `head={false}` prop to `CalendlyInline`, and have `BookingBand` pass it. Only the dialog keeps the card head.

---

## 5. Proof visuals

| Where | Issue | Fix |
|---|---|---|
| Family hero [1440](critique-shots/lse-seo-for-family-lawyers-1440.png) | A full jackknife results page at about 460 px wide, text about 5 px. Tag "Still cited a week later". The caption has to explain that it is a PI result | Use a `proof.ts` crop of the AI chip and the result row (the PI page already crops this capture well). Caption: "A PI firm in New Orleans: #1, and still cited by Google's AI a week later." Drop the second sentence |
| Immigration hero [1440](critique-shots/lse-seo-for-immigration-lawyers-1440.png) [390](critique-shots/lse-seo-for-immigration-lawyers-390.png) | A full results page from the Google logo down, "Sponsored Results" first, the proof line below the fold. On a phone the text is about 4 px | Crop to the AI answer and the key-firms block (`nolaKeyFirm` with `crop: 'keyFirms'`), and add a `phone` set |
| Criminal and about heroes | Two GBP charts side by side at about 430 px each. The axis and labels are about 6 px | One chart, the "after", at 7 columns, with its `phone` set. The grey "9" in the number pair is the "before" |
| Consultant hero | A big "23", then a chart tagged "23 calls", then the chart's own "23" marked: three 23s in one view | Keep the chart and the tag only. Or keep the number pair "9 to 23" and no chart |
| DUI hero | The tag "9 calls in October" sits on a capture whose biggest number is "22" (the 5-month total) | Tag "From 1 to 9 calls a month" and mark the October point. Or crop the capture below the "22" |
| Bankruptcy hero | 43 shown four times (big number, tag, bubble, caption), plus a bold line | The chart with its tag only. Caption: one line |
| IP hero | The result card is small (about 460 px). The caption plus a bold line make 4 lines of text under a 90 px capture | Make the card wider (7 columns), the caption one line, and move the bold line out |
| Employment hero | The caption is a 5-line paragraph set as the panel's left column, at lead size | A 1-line caption under the capture. The capture takes the full panel |
| Services hero | Readable, with the right mark and the "#1" tag, but below the fold at 1440 | Split layout (section 2.2) |
| Tags generally | Good: short, black on the swipe, half off the frame. Weak ones: "Still cited a week later" (too long for a tag), "Named in the AI answer" (long), "New Orleans" (a place, not a result) | Tags of 3 words or fewer that state a result ("#1", "Key firm", "139 calls", "AI source #1"). Places go in the caption |
| Captions generally | Most are 2 to 4 lines and some carry an argument ("The same work can put an employment firm...") | One line: whose result, what happened, when. The argument goes in the copy, not the caption |
| Depth zones | Almost no proof between the hero and the close. PI's "What happened when a New Orleans firm published its truck accident pages?" shows the three results as a table with no screenshot ([PI 390 band](shots/seo-for-personal-injury-lawyers-390.png)) | Put the real captures (`nolaTankerQuery` with `nolaKeyFirm`, `nolaJackknife`, `nolaWtdRank`) into that section as `ProofFigure`s through a `[slot proof]` marker. The same goes for "How quickly can new patent pages rank" on IP, and the license-deadline section on DUI (`elpasoAiDeadline`) |

---

## 6. Depth zones

Looked at on the full-page shots: [PI 1440](shots/seo-for-personal-injury-lawyers-1440.png), [PI 390](shots/seo-for-personal-injury-lawyers-390.png), [DUI 1440](shots/seo-for-dui-attorneys-1440.png), [services 1440](shots/law-firm-seo-services-1440.png), [consultant 1440](shots/law-firm-seo-consultant-1440.png), [IP 1440](shots/seo-for-intellectual-property-lawyers-1440.png).

What works and stays: the 35em measure (about 75 characters a line) reads well; the hairline tables are clean and stack well on phones; the jump list is always visible and numbered; the checklists and numbered steps break up the text; the open FAQ needs no clicks; the byline and author box are quiet; the depth stays below the commercial top.

| Issue | Where | Fix |
|---|---|---|
| The right 45% of the screen is empty for most of the page at 1440, so it reads as a long thin wall with a void beside it | All v3 pages | Don't fill it with side notes (margin notes are banned since v1). Instead: (a) set the worked-example sections as `Split 7/5`, text left and the real proof right; (b) let tables and proof run to the 1040 px width (they already can) and use that at least every second section; (c) start the reading column one column in (about 96 px), so the empty space is balanced and not all on the right |
| Depth H2s are 3-line questions at the full 56 px H2 size, so each section opens with a shout, and 9 of them in a row is heavy | All v3 pages, e.g. "Which pages does an injury firm need, by case type, city and claim stage?" | Depth H2s at `clamp(28px, 1.4vw + 18px, 40px)`, max-width 24ch. The commercial H2s keep 56 px. That also tells the reader where the selling stops and the guide starts |
| The summary is a 120-word paragraph at lead size (about 10 lines at 1440, 17 on a phone) | Top of every zone ([PI crop](shots/seo-for-personal-injury-lawyers-1440.png), about y 1400) | Set the first sentence (the short answer) at lead size and the rest at body size. Or bold the "short answer" sentence that is already in the copy. No new words needed |
| The disclaimer ("This is general information about marketing, not legal advice...") repeats in small grey text inside sections | PI section 5, DUI, consultant, IP | Once per page, above Sources |
| Gaps: about 160 px around each hairline, plus band padding, plus about 200 px between the author box and the closing H2 | All v3 pages | Tighten the space above a depth H2 to `--s6` (64 px). Keep `--section` only around full-width bands |
| The mid-page band is a fog strip with a 3-line sentence and a button. Good in idea, but it looks like a leftover | PI ("Fahim will check this page map...") and others | Make it the trust moment: Fahim's face xs, the line, the button. Same wording rules as section 3 |
| On phones the jump list is about 700 px tall before the first section | Every v3 page at 390 | Fine to keep. Set the rows tighter (12 px padding, not 16) |
| Stacked tables on phones repeat the column label on every row ("What people type", "Page that answers it") | PI, DUI, services at 390 | Fine and readable. For tables with more than 6 rows, shorten the muted labels in the copy |
| Visual relief with no new data | All | Callouts already in the copy (`> **Lead.**`) are good. Use them for real facts already in the text, set larger (22 px): "Texas gives drivers 15 days to ask for a license hearing.", "The New York row is new." One per long section, never in a heading |

---

## 7. Sitewide

| Area | Finding | Fix |
|---|---|---|
| Header | Clean: lockup, 5 links, one button. "Practice areas" links to `/#practice-areas`, so from an inner page it jumps to the homepage, and the 11 practice pages are never listed in the header | Make "Practice areas" a disclosure button that opens a plain list panel (11 text links on hairlines, like `PracticeLinks`). No mega-menu, no icons |
| Header button | "Book a ranking review" at 16 px bold with tight tracking | It changes with section 3.3. Keep `--sm` |
| Mobile menu [390](critique-shots/menu-open-390.png) | The panel stops after the button and the page shows through under it, cut mid-line ("A PI firm in New Orleans..."). No backdrop. The toggle still says "Menu" when open | Fill the panel to the bottom of the screen (white) or add a backdrop, change the label to "Close", and lock the page scroll while it is open |
| Footer | Black, plain, every page listed, legal line. Good | Keep. Optional: add the reply line under the email |
| Colour | The highlighter is right on tags, marks, the price band and the face swipe. It is overused when one first screen has 4 or more marker blocks (consultant: the 23 swipe, the tag, the chart mark, the date marks). Careers puts the marker on running text that isn't proof ("small team helps with the production work") | At most one tag plus 2 marks per first screen. Remove the careers mark |
| Type scale | H1 is 66 px in split heroes and 78 px in top and stack heroes, against 86 px on the homepage. Fine. The problem is length: 4 to 5 line H1s and 4 to 5 line leads on phones | The hero budget (section 2.3). No size change needed |
| Forms | A 2 px black outline box on every hero form; a pill-shaped website field beside rectangular name and email fields | No outline (or a fog panel with no border), one field shape (8 px radius everywhere, keep the search icon in the website field) |
| Talk line | "Prefer a call?" on some pages, "Rather talk it through?" on others | One string in `PageHero`'s default, and remove the page overrides |
| Buttons | One style, black, hovers to the highlighter, never two side by side. Good | Keep |
| Spacing | Hero bottoms vary a lot. Family and IP leave 150 to 250 px of empty space under the hero at 1440 | It's fixed by the hero standard (proof and form sit side by side) |
| Templated looks | The same "stack plus full-width row form plus 'Prefer a call?'" on SEO services and estate planning; the same "9 to 23 plus two charts" on criminal, consultant and about; the same `FinalCta` (H2, button, then "Prefer to put it in writing?" with a 4-field form and an empty right half) at the end of every page | Section 2.3 variants, a new about hero, and the call-first close |
| Careers [1440](critique-shots/lse-careers-1440.png) | The role H2 "Video editor" has its text in the right column: text to the right of an H2, which the owner banned | Stack it: H2, the meta line, the text, the apply link |
| Blog post [1440](critique-shots/lse-how-to-get-clients-as-lawyers-1440.png) | The jump list is a `<details>` with a "▼ In this post" toggle (`PostLayout.astro:82`). It's open, but it looks like an accordion and can be closed | A plain list with a heading, like the depth zone's `Toc` |
| Booking band blocked state | Collapses to a short box ([shot](critique-shots/cal-contact-blocked-1440.png)) | Section 4.2 |

---

## 8. What's working and must stay

- The homepage: its hero shape, the 139-calls chart with its tag and marks, the logos, and the short copy. Change only the form words and the CTA label.
- The Marked system: white, black, one highlighter used only on proof, Libre Franklin, hairlines instead of cards. It doesn't look like LCME, and it doesn't look cream or editorial.
- Tags on the swipe, half off the frame, and highlighter strokes on the exact proof line. This is LSE's signature: keep it, just with fewer per screen.
- The pricing hero: the price card as the visual, the struck "hired one by one" total and the marked "from $2,000 a month". The clearest page on the site.
- The PI hero: the closest inner page to the homepage bar, and the only one with logos in the first screen.
- The bios: big real cutouts on the swipe, one claim each, LinkedIn links. Clean.
- The contact page: the form, the face and the reply line, plus "After you send it" as plain rows.
- Depth zones: the measure, the hairline tables that stack on phones, the open FAQ, the visible numbered jump list, sources, and the byline. The depth is right; only the layout around it needs work.
- One button style, never two side by side; no eyebrows; no all-caps; no accordions for results.
- The footer.
- Calendly loaded lazily, and the dialog mounting only on open. Keep it; just fix what shows while it loads.

---

## 9. Fix plan in batches

Do them in order. Each batch ends with `npm run build` (check-dist and check-unique), the e2e tests where touched, and 1440 and 390 shots of the pages changed, all under the build lock.

| Batch | What | Files | Size |
|---|---|---|---|
| 1. Calendar loading | One skeleton with a progress line in the card; state classes from JS; the 8 s slow timer from mount; the blocked state at once with the form line; `head={false}` for bands; the face in the card head; e2e cases | `src/components/CalendlyInline.astro`, `src/scripts/calendly.ts`, `src/components/kit/BookingBand.astro`, `src/features/booking-dialog/BookingDialog.astro`, `tests/e2e/` | M, about 150 lines |
| 2. CTA words (after the owner OKs the label) | New form heading, sub and button (option 1); the new label and sub line; the closing H2s via the copy decks; one talk line | `src/data/site.ts`, `src/components/LeadForm.astro` (default `submitLabel`), `src/components/kit/PageHero.astro` (default `talk`), `src/components/FinalCta.astro`, every page's `form` props in `src/pages/**`, `content/v2/*` decks, `research/FACTS.md` (owner) | M, copy across about 25 pages |
| 3. Trust beside the action and a lighter form | A trust row under every hero form (face xs, reply line, small logos); no outline on the compact form; one field shape | `src/components/kit/PageHero.astro`, `src/components/kit/TrustLine.astro` (a small size), `src/components/LeadForm.astro` styles | S to M |
| 4. Hero clean-up, page by page | Apply the section 2.2 table and the 2.3 variants: cut repeated numbers, rules, bold lines and paragraph captions; switch the stack-row heroes to split; new crops for family, immigration, DUI, criminal and about; `visualFirst` with a compact crop on phones; the about hero with the people | Every service and practice `src/pages/<slug>/index.astro`, `src/data/proof.ts` (new crops and `phone` sets), `src/components/<group>/` hero pieces. Bankruptcy, immigration and med mal go to their own builder | L, 17 pages |
| 5. Call-first close | `FinalCta` becomes the calendar split with faces and a "Prefer to write?" link; remove the top booking bands on pages that now have a hero form; check that `#book` still lands on it | `src/components/FinalCta.astro`, pages using `BookingBand` (consultant, criminal, family, employment, IP, immigration, pricing, contact) | M |
| 6. Depth zone layout | Smaller depth H2s; the summary's first sentence at lead size; the disclaimer once; tighter gaps; `Split 7/5` proof beside the worked examples through a `[slot proof]` marker; the mid band with the face; callout size | `src/components/depth/DepthZone.astro`, `src/styles/prose.css` (or the depth styles), `src/content/depth/*.md` (add `[slot proof]` in 3 to 5 pages), those pages' `slot="proof"` children | M to L |
| 7. Sitewide polish | Mobile menu fill and "Close"; the "Practice areas" list panel; careers role stacked and its mark removed; the blog jump list as a plain list; tag lengths | `src/components/Header.astro`, `src/pages/careers/index.astro`, `src/components/blog/PostLayout.astro`, tag props on pages | S to M |
| 8. Re-shoot and judge | First screens at 1440 and 390 for every page; the calendar slow and blocked states; the dialog; compare against this file | `docs/shots/`, `docs/critique-shots/` | S |
