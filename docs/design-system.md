# LSE design system

Tile A, "the marked-up brief" (`../brand/BRAND-NOTES.md`, owner-approved 2026-11-08). Logo concept 3, the highlighter S. Read this before building an inner page. Pages share the language below and get their own section layouts: don't copy the homepage's order or shapes.

Screenshots of the homepage: `docs/shots/home-1440.png` and `home-390.png`.

## The idea

Real artefacts (a Google result, a work log, Search Console, Semrush) shown as white sheets on warm paper, then marked up like a brief someone reviewed: one highlighter stroke on the fact that matters, a rank chip for a real position, an italic margin note saying when and how it was measured. Everything else stays quiet: hairlines, generous space, one button.

## The owner's rules (they never bend)

- One CTA label everywhere: "Book a ranking review". One button per view. Never two buttons, or a button and a form, side by side. Other actions are text links.
- No eyebrows, no all-caps, no mono fonts, no labels above headings, no text to the right of an H2.
- No em dashes in visible text (check-dist fails the build). No "→" on links. No middle-dot strings.
- Headings are full sentences that end with a full stop. Questions only in the FAQ.
- Hairlines over boxes. The only boxed things are real documents (results, logs, screenshots) and form fields.
- Body text contrast at least 4.5:1. The marker colour only sits behind ink text or fills large marks; never as text, icons or thin lines.
- Every number is real and dated, with its source next to it, or it is a designed placeholder. Never fake data.
- No carousels, no decorative motion, no scroll reveals. Motion only answers an action (menu, FAQ, dialog). Reduced motion turns transitions off.
- Nothing from LCME's look: no `#0066FF` or royal blue, no Schibsted Grotesk, no dark hero with a calendar on the right, no receipt price block, no rings plus numbered markers, no blue index band. No `cmo-` or `pr-` class prefixes (check-unique's leak scan).
- No scales, gavels, columns, seals, shields, laurels, rockets, 3D art or handshake stock.

## Tokens (`src/styles/tokens.css`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F3F2EA` | page base |
| `--sheet` | `#FFFFFF` | documents and results only (ink 13.08:1) |
| `--ink` | `#12372A` | text, buttons, footer, section rules (11.65:1) |
| `--ink-2` | `#3C5449` | secondary text, leads, notes (7.31:1) |
| `--muted` | `#5F6E66` | small meta only, 15px and up (4.78:1) |
| `--rule` | `#CBD0C2` | hairlines, never text |
| `--marker` | `#D4F04A` | highlight behind ink, rank chip, button hover. 1.14:1 on paper: never text |
| `--hatch` | `#E4E6DC` | placeholder fill, photo backdrop |
| `--on-ink`, `--on-ink-2` | `#F3F2EA`, `#B9C9BE` | text on the ink footer |

Type: `--serif` Newsreader 500 (optical size on) for H1 to H3, numerals and price lines; Newsreader italic 400 for margin notes and captions. `--sans` Source Sans 3 400/600 for body, UI and buttons. Scale: `--fs-h1` 44 to 88, `--fs-h2` 32 to 52, `--fs-h3` 23 to 28, `--fs-lead` 19 to 23, `--fs-body` 17 to 19, `--fs-note` 18, `--fs-meta` 15. Body never under 17px; meta never under 15px.

Fonts are self-hosted in `public/fonts/` (Latin subset, woff2, `font-display: swap`). Roman serif and sans are preloaded in `Base.astro`. The `... Fallback` faces are Georgia and Arial with `size-adjust` and metric overrides, so the swap moves nothing (CLS 0). To add glyphs, re-subset from the Google Fonts variable TTFs with fontTools (Newsreader roman pinned to wght 500, opsz 16 to 72; italic wght 400, opsz 18; Source Sans 3 wght 400 to 600).

Space: 8px base (`--s1` 8 to `--s7` 96), `--section` clamp(80px, 10vw, 144px), `--wrap` 1200px, `--gut` clamp(16px, 4vw, 40px), margin-note column `--note-col` 280px with `--note-gap` 64px. Radius: 4px buttons, 6px sheets, irregular `--r-mark` on marks so they feel hand-made.

## Global classes (`src/styles/global.css`)

- `.lse-wrap`: the centred container. `.lse-section`: a page section with `--section` padding; consecutive sections get a 1px ink rule between them.
- `.lse-lead`: the paragraph under an H2 (moss, larger). `.lse-section__lead` adds its top margin. `.lse-small`: meta text.
- `.lse-bridge`: the serif line that hands one section to the next. Optional; use it when the copy has one.
- `.lse-review`, `.lse-review__main`, `.lse-review__side`: the review grid. Content left, margin notes right at 1080px and up; under that, notes drop below the content.
- `.lse-mk` (or `<mark class="lse-mk">`): the highlight. `.lse-chip`: the rank chip. `.lse-sheet`: a white document.
- `.lse-btn`: the button looks (also used by form submits). `.lse-links`: text links in a row.
- `.lse-ph`, `.lse-ph--block`: placeholder looks (use the component).
- `.lse-vh`: visually hidden.

Page-only layout goes in the page's `<style is:global>` with classes prefixed by the page (the homepage uses `lse-hero` and `lse-s1` to `lse-s7`). Global, because Astro's scoped styles don't reach into child components.

## Components (`src/components/`)

| Component | What it is | How to use it |
|---|---|---|
| `Header` | Lockup, five links, one button; a disclosure menu under 960px | In `Base.astro`. Links come from `site.nav` |
| `Footer` | Ink footer: line, email, every planned page, legal links | In `Base.astro`. Links come from `src/data/pages.ts` |
| `Logo` | Inline concept-3 lockup, `variant="reverse"` for ink | Header and footer already use it |
| `Button` | The booking CTA (`/#book`, opens the dialog) | `<Button />`. One per view. `size="sm"` in tight places. Full width on phones unless `block={false}` |
| `Mark` | The highlight | `<Mark>the one fact</Mark>`. Once per block, never in an H1 |
| `MarginNote` | Italic note with a leader into the content | Inside `.lse-review__side`. Say when and how: "Google, US, 8 Nov 2026" |
| `SerpFigure` | A real search screenshot on a sheet, with marks, a rank chip and brackets layered in HTML | Positions are percentages of the image. Never larger than the image's natural size. `priority` only in a hero |
| `Shot` | A plain proof screenshot with an italic source caption | Every capture needs a dated caption. Crop out backlink and referring-domain counts before adding |
| `ResultRow` | A hairline row: a big serif `figure` with its sentence and `source`, or a bold `title` with text and a `media` capture | Every number with its source and date |
| `WorkLog` | The monthly log as a document table (stacks on phones) | Rows from `src/data/worklog.ts`. `highlight` plus the `note` slot marks one row |
| `PriceLine` | A starting price as a serif sentence, what it covers, text links | Only "from $2,000 a month" and "from $2,000" (check-dist). Never a receipt, tier table or comparison |
| `TermsList` | Bold sentence plus plain explanation, hairlines between | Contract terms, who shouldn't hire us |
| `PracticeLinks` | The practice pages in columns, each with a real search phrase | Reads `practicePages` |
| `Faq` | Native `<details>` accordion, first open | Build FAQPage JSON-LD from the same items with `faqSchema()` in `src/lib/schema.ts`. No "Related" block under it |
| `FinalCta` | Closing section: H2, lead, button; below it after a hairline "Prefer to put it in writing?" and the form | Once per page, last. Carries `id="book"`. Pass a `formLabel` for the lead email |
| `LeadForm` | The ported lead form (name, email, website, optional message; `phone` adds a field) | Inside `FinalCta`, or alone on the contact page with `titleTag="h2"`. Keep its data-* hooks |
| `Placeholder` | A hatched, labelled stand-in | `collect` says exactly what to collect. `block` with `width`/`height` for a missing image |

Booking dialog and Calendly embed: `src/features/booking-dialog/`, `CalendlyInline.astro`. Their words are the CTA's (`site.cta`).

## Placeholders and planned pages

- A placeholder renders with `data-placeholder="what to collect"`. A Preview build passes with a warning listing them; a launch build (`STRICT_REDIRECTS=1 npm run build`) fails while any is left.
- Links to pages that aren't built yet must be listed in `src/data/pages.ts`. They pass with a warning until launch; at launch every one must be built. Build a page, and its link stops warning by itself.

## Images

- Proof captures: `public/img/proof/`, webp, with `width` and `height`. Show them no larger than their natural size; never upscale. The current captures are low resolution and flagged for recapture before launch.
- People: `public/img/people/`. Fahim's photo is the real portrait on a flat `--hatch` backdrop, 4:5. Josh's photo stays a placeholder until the owner confirms it is him.
- Icons: `favicon.svg` (the S mark), `favicon.ico` (16 and 32), `apple-touch-icon.png` (180), `icon-192.png` and `icon-512.png` (`site.webmanifest`). Share image: `public/img/og-default.png`, 1200x630, the H1 on paper with the lockup and a rank chip. A page that needs its own share image follows the same layout.

## Writing on a page

Use the copy file for the page exactly. Before building, check it against `scripts/unique-config.json`: banned LCME phrases fail the build anywhere on the page (for example "no account managers" and "no long contract"). Change the fewest words that keep the meaning, and note it in `docs/DECISIONS.md` for the judge.
