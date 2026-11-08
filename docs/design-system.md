# LSE design system: "Marked"

Homepage v2, 2026-11-08. It replaces Tile A (cream paper, Newsreader serif), which the owner rejected. Read this before building an inner page. Pages share the language below and get their own section layouts: don't copy the homepage's order or shapes.

Screenshots: `docs/shots/home-v2-1440.png`, `home-v2-390.png`, and the two other directions in `variants-1440.png`, `variants-390.png` (live at `/variants/`, noindex).

## The idea

White paper, black ink, and one highlighter: the logo's chartreuse. The highlighter only ever marks proof. In a real screenshot it sits on the exact line that proves the claim (a #1 result, "16 hours ago", a call count), and as a swipe tag on the frame's corner it states the result ("#1", "139 calls"). Results are the headlines and the biggest things on the page; words are short. The type is Libre Franklin, the American newspaper grotesk, set big and tight.

## The owner's rules (they never bend)

- Lead with what the firm gets. Results come first and big, with their screenshot next to them. The people come after the results.
- A way to act sits in the hero or the section straight after it: the short form (`LeadForm compact`) or a real booking embed. A button that only opens a dialog does not count. The reply line goes next to the form: "Fahim answers within an hour in business hours."
- One CTA label everywhere: "Book a ranking review" (opens the booking dialog). Never two buttons side by side. A text link under a form is fine.
- Little text: a headline that says the point, one or two short lines, then the visual. No paragraph a skimmer would skip.
- Results are never hidden in text, tabs, carousels or accordions. Screenshots open full size on click.
- No firm names in result text or headings ("a PI firm in New Orleans"). Named logos only in the trust line.
- No eyebrows, no all-caps labels, no text to the right of an H2, no em dashes, no "→" on links, no middle-dot strings.
- No "16 hours" as a general promise: it is one firm's result and always travels with "after about three months of groundwork".
- No prices in the hero. Only "from $2,000 a month" (SEO) and "from $2,000" (website build); check-dist enforces it.
- Nothing from LCME's look: no `#0066FF` or any royal blue, no navy, no Schibsted Grotesk, no dark hero with a calendar on the right, no receipt, no rings with numbered markers, no blue index band, no `cmo-` or `pr-` classes.
- Banned looks: cream, beige, ivory or paper backgrounds; editorial serif; centred everything; uniform card grids; gradient blobs; glassmorphism; emoji icons; stock illustrations.

## Tokens (`src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#FFFFFF` | page |
| `--fog` | `#F1F3F0` | alternate bands, the panel behind the hero result. Ink on it 19.1:1 |
| `--ink` | `#000000` | headings, numbers, buttons, footer |
| `--ink-2` | `#2B2D29` | body and leads (14.2:1) |
| `--muted` | `#5D6159` | captions and meta, 15px and up (6.3:1; 5.7:1 on fog) |
| `--line`, `--line-2` | `#D8DCD4`, `#B6BBB1` | frames, hairlines, rules. Never text |
| `--marker` | `#D4F04A` | the highlighter. Behind ink only (16.9:1). Never as text or a thin line on white |
| `--on-ink`, `--on-ink-2` | `#FFFFFF`, `#B9BCB5` | footer text |

Type: one family, Libre Franklin (variable 400 to 900, Latin subset, `public/fonts/libre-franklin.woff2`, 24 KB, preloaded). H1 800 at `--fs-h1` (44 to 86px), tracking -0.038em, line-height 0.98. H2 800 at `--fs-h2` (32 to 56px), -0.032em. H3 750 at `--fs-h3` (22 to 28px). Result numbers 900 at `--fs-num` (76 to 152px), -0.055em. Lead 19 to 22px, body 17 to 18px, meta 15px. The fallback face is Arial with `size-adjust` 103% and metric overrides, so the swap moves nothing. To add glyphs, re-subset `LibreFranklin[wght].ttf` from Google Fonts with fontTools (instancer wght 400 to 900, then subset to woff2).

Space: 8px base (`--s1` 8 to `--s7` 96). `--section` clamp(72px, 8.5vw, 132px). `--wrap` 1280px. `--gut` clamp(16px, 4vw, 48px), so phones get 16px. Shape: `--r-btn` 8px, `--r-frame` 12px, `--swipe` (the logo's off-square block, a clip-path) for tags and marked numbers. `--shadow-lift` only where a frame sits on a panel (the hero).

Layout: left-aligned. Headings on top of their section, the visual below or beside them (never text beside a heading). Asymmetric splits on a 12-column feel: 5/7 or 7/5 at 1000px and up, one column under it. Bands alternate white and fog; the price band is the one marker-coloured band per page; the footer is black.

## The marks

- **Highlighter on a screenshot** (`Shot`, `marks`): a chartreuse stroke with `mix-blend-mode: multiply`, so the text under it stays dark. Boxes are percentages of the image, measured from its pixels around the exact text. One to three per image. They draw in once, left to right, when the frame scrolls into view (`src/scripts/marks.ts`); reduced motion shows them at once.
- **Tag** (`.lse-tag`, `Shot tag="#1"`): black Franklin 900 on the swipe, half off the frame's top corner. Only a real rank or result. `tagSmall` for a place label ("The Map").
- **Marked number** (`.lse-h-num--marked` on the homepage): a result number on the swipe. A grey number beside it is the before.
- **`.lse-mk`**: a highlight behind a few words of running text. One per block, never in a heading.

## Motion

Only where it explains: marks drawing in on screenshots, and result numbers counting up once (`data-count`). Nothing loops, nothing slides in by itself. `prefers-reduced-motion` turns it all off.

## Components (`src/components/`)

| Component | What it is | How to use it |
|---|---|---|
| `Header` | Lockup, five links, one button; a menu under 960px | In `Base.astro` |
| `Footer` | Black footer: line, email, every planned page, legal links | In `Base.astro` |
| `Logo` | The concept-3 lockup redrawn in Libre Franklin. `variant="reverse"` on black | Header and footer use it |
| `Button` | The booking CTA ("Book a ranking review", opens the dialog) | One per view. `size="sm"` in tight places |
| `Shot` | Real screenshots in one frame (stack a search box over its result), with marks, an optional tag and `crop` | Every capture needs a caption that says whose result it is, without the firm's name. Never larger than natural width |
| `LeadForm` | The lead form. `compact` is the hero version: website first (set like a search box), name and email, no message | Each form on a page needs its own `idPrefix` and `label` (source_form) |
| `CalendlyInline` | The booking calendar. `lazy` mounts it when it nears the screen | For a booking band. The dialog has its own |
| `FinalCta` | Closing section: H2, lead, button, then "Prefer to put it in writing?" with the form | Once per page, last. Carries `id="book"` |
| `Faq` | Native `<details>`, first open, hairlines, a marker dot when open | Build FAQPage JSON-LD from the same items with `faqSchema()` |
| `PracticeLinks` | The practice pages as big text links with hairlines; the hover is the highlighter | Reads `practicePages` |
| `Placeholder` | A hatched, labelled stand-in, `data-placeholder="what to collect"` | Never fake data |

Sitewide features (`src/data/features.ts`): tracking, the booking dialog, and image zoom (every `Shot` image with alt text opens full size; Enter or Space too).

## Images

- Proof: `public/img/proof/`, webp, real captures only. Names say the market and what it is (`nola-calls-jun-oct-2026.webp`), never the firm. Our own result: `lse-serp-lawyer-seo-expert-2026-11-08.webp` (one screenshot; no Search Console or Semrush numbers on the homepage).
- Logos for the trust line: `public/img/logos/<firm>-ink.webp` on white, `-white.webp` on dark.
- People: `public/img/people/fahim.webp`, `josh.webp`, transparent cutouts, set on a marker swipe (`.lse-h-face`).
- Share image: `public/img/og-default.png`, 1200x630: lockup, the H1, the calls chart with its tag, a black bar at the foot.
- Icons: `favicon.svg` (the S on the swipe), `favicon.ico`, `apple-touch-icon.png` and `icon-192/512.png` (the mark on black).

## Writing on a page

Use the page's copy file exactly. Check it against `scripts/unique-config.json` before building: banned LCME phrases fail the build. A literal Google search quoted as evidence goes in `<q data-no-check>` (the screenshot shows the same words). Everything else is rewritten, never exempted.
