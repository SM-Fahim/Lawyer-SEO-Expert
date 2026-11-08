# The inner-page kit

Shared pieces for every inner page, in `src/components/kit/`, plus the `InnerPage` layout and shared data in `src/data/`. Every piece is live at `/kit/` (noindex, out of the sitemap) with real copy from the v2 decks; screenshots in `docs/shots/kit-1440.png` and `kit-390.png`. The look is the homepage's ("Marked", `docs/design-system.md`): several pieces were moved out of the homepage, and the homepage now uses them, unchanged to the pixel.

Rules that come with the kit:
- One H1 per page (PageHero). One button label ("Book a ranking review"), never two buttons side by side. No price in a hero, except `/seo-pricing/` and `/lawyer-web-design-development/`. One PriceBand at most.
- Each page builds its own section order from its deck. Pages in one group must not use the same hero layout and the same sequence of pieces.
- Never retype a proof image's size, alt or marks: import it from `src/data/proof.ts`. Never retype a price row: `src/data/pricing.ts`.
- A page that shows dollar amounts other than $2,000 needs them in its own `PRICES_BY_PAGE` entry in `scripts/check-dist.mjs` (the breakdown rows: `'1,200', '1,000', '750', '500', '125', '300', '150', '4,000'`).
- Placeholders: use `Placeholder` (or `SearchPanel`'s `placeholder`) and never fake data.

Imports below are from a page in `src/pages/<slug>/index.astro`.

## Layout and schema

### `InnerPage` (`src/layouts/InnerPage.astro`)
The shell: Base (head, header, footer, tracking, booking dialog, image zoom), the visible breadcrumb trail, and the page's JSON-LD.

| Prop | Type | Notes |
|---|---|---|
| `title`, `description`, `path` | string | From the deck (title and meta option 1 unless a Judge note says otherwise). `path` with trailing slash |
| `crumbs` | `{ label, href? }[]` | The trail after Home; the last item is this page. Builds BreadcrumbList JSON-LD and the visible trail |
| `service` | `{ name, description?, serviceType?, offer? }` | Service JSON-LD. `offer`: `'monthly'` (from $2,000 a month, default), `'once'` (from $2,000, web builds), `false` |
| `faq` | `FaqItem[]` | FAQPage JSON-LD. Pass the same array you give `<Faq>` |
| `schema` | `object[]` | Anything else (Person, ProfilePage on bios) |
| `pageType` | `'service' \| 'pricing' \| 'booking' \| 'company'` | Default `'service'`. About pages: `'company'`; `/seo-pricing/`: `'pricing'`; `/contact-us/`: `'booking'` |
| `hideCrumbs` | boolean | Hides the visible trail only |
| `noindex`, `ogTitle`, `ogDescription`, `ogImage` | | As in Base |

```astro
<InnerPage title="SEO for Personal Injury Lawyers | Win Every Case Type" description="..." path="/seo-for-personal-injury-lawyers/"
  crumbs={[{ label: 'SEO for personal injury lawyers' }]} service={{ name: 'SEO for personal injury lawyers' }} faq={faq}>
  ...
</InnerPage>
```
Helpers in `src/lib/schema.ts`: `breadcrumbSchema()`, `serviceSchema()`, `faqSchema()` if you need them directly.

### `Breadcrumbs`
Rendered by InnerPage: "Home / Page" in muted meta type above the hero. Props: `trail`. You don't place it yourself.

## Sections

### `PageHero`
H1, one line, the compact LeadForm (website first) with "Rather talk it through? Book a ranking review" under it, and the visual.

| Prop | Type | Notes |
|---|---|---|
| `h1`, `lead` | string | |
| `layout` | `'split' \| 'top' \| 'stack'` | `split`: H1, line, form left (5), visual right (7). `top`: H1 and line across, then visual (7) and form (5). `stack`: H1, line, form as one row, visual full width |
| `flip` | boolean | `split`: visual left. `top`: form left, visual right |
| `panel` | boolean | Visual on the fog panel (default true). Off for a white hero (med mal) |
| `form` | `{ title, sub?, idPrefix, label, submitLabel?, format?, practiceArea?, titleTag? }` | Leave out when a booking band or form section follows straight after the hero |
| `talk` | string or false | Words before the booking link. Default "Rather talk it through?" |
| `formRow` | boolean | The form as one row (default in `stack`) |
| `visualFirst` | boolean | Visual before the form (`top`, `stack`; phones too) |
| slots | `visual`, `text`, `after` | `text`: under the line (credentials, LinkedIn). `after`: under everything (TrustLine) |

Phones: one column, H1, line, form, then the visual.
```astro
<PageHero h1="SEO for personal injury lawyers: own the searches after a crash." lead="We build ..."
  form={{ title: 'Send your website for an injury ranking review.', sub: 'Fahim answers within an hour in business hours.', idPrefix: 'pi-hero', label: 'pi-hero' }}>
  <figure slot="visual"><Shot tag="Key firm" tagSide="right" priority images={[shot(proof.nolaTankerQuery), shot(proof.nolaKeyFirm, { marks: ['heading', 'firmRow'] })]} /><figcaption class="lse-small">...</figcaption></figure>
  <TrustLine slot="after" />
</PageHero>
```
Give the hero image `priority` (it is the LCP). A bio hero puts a `Face` (with `priority`) in the visual slot and `panel={false}`.

### `Band`
A section: H2, optional lead, content below (never beside the H2).

Props: `heading`, `headingId` (unique), `lead`, `tone` (`'white' | 'fog' | 'marker'`), `id`, `wideHeading` (26ch instead of 20ch), `flushTop`, `class`. Alternate white and fog down the page. `'marker'` only on a page with no PriceBand.
```astro
<Band heading="Three places an injury client finds you." headingId="places-h" tone="fog">...</Band>
```

### `BookingBand`
The real calendar as a section (the way to act when the hero has no form). Calendly mounts only as it nears the screen; a calendar-shaped skeleton holds the space.

Props: `heading`, `headingId`, `lead`, `layout` (`'full' | 'split'`: text 5 left, calendar 7 right), `tone` (`'white' | 'fog'`), `id` (`"book"` when it closes the page instead of FinalCta), `class`. Slots: default (a reply line beside or under the lead), `after` (under the calendar).
```astro
<BookingBand heading="See your county's results with Fahim." headingId="book-h" tone="fog"
  lead="A free 30-minute ranking review. He searches your top charges in your county with you, live." />
```

### `PriceBand`
The one highlighter band. Reads `src/data/pricing.ts`.

| Prop | Notes |
|---|---|
| `heading` | string, or string[] (each part stays on one line where it fits) |
| `headingId` | |
| `variant` | `'breakdown'` (rows with struck total left, our line right: the homepage), `'total'` (one column: lead, struck total, our line), `'plain'` (lead, default slot, button) |
| `lead`, `us`, `usMark`, `note` | `usMark`: words inside `us` set on the white swipe |
| `big` | An amount set at result-number size on a white swipe (`"$2,000"`, `"$500"`) |
| `button` | Default true |
| slots | default (rows, terms), `link` (a text link under the button) |
```astro
<PriceBand variant="total" heading="All four parts, one monthly price." headingId="price-h" lead="Many agencies sell SEO one part at a time."
  us="With us, all four: from $2,000 a month. No setup fee." usMark="from $2,000 a month">
  <Fragment slot="link">See what each part costs on its own on our <a href="/seo-pricing/">law firm SEO pricing</a> page.</Fragment>
</PriceBand>
```
Terms as rows on the band: `variant="plain"` with `<Rows variant="big" .../>` in the default slot.

### `PriceCard`, `PriceList`
`PriceCard` is the breakdown as a white card for a hero visual on the fog panel (`/seo-pricing/`). Props: `title`, `titleTag`, `us`, `usMark`.
`PriceList` is the rows plus the struck total on their own. Props: `rows` (default `included`), `total`, `totalLabel` ("Hired one by one:"), `totalOnly`.
```astro
<PriceCard slot="visual" title="What each part costs when a firm buys it on its own" titleTag="h2"
  us="Every row above, with us: from $2,000 a month." usMark="from $2,000 a month" />
```

## Layout helpers

### `Split`
Two columns at 1000px and up. Props: `ratio` (`'5/7' | '7/5' | '6/6' | '4/8' | '8/4'`), `align` (`'start' | 'center' | 'end'`), `bFirst` (slot b first on phones: "visual first"), `rule` (hairline above, for stacked zig-zag rows). Slots `a` (left) and `b` (right).
```astro
<Split ratio="7/5" rule><Rows slot="a" variant="inline" items={rows} /><PhoneShot slot="b" images={[shot(proof.elpasoSiteMobile)]} /></Split>
```

### `Cols`
Equal columns: `count` 2 (two at 700px and up) or 3 (three at 1000px and up), `gap` (`'md' | 'lg'`), `align`. Each child is a column. Three-up only for strip captures (a rank result, a search box over it): a full results page in a third of the width is too small to read.

## Proof

### `Shot` (existing) and `src/data/proof.ts`
Every capture is one entry: `src`, `width`, `height`, `alt`, `caption`, `source`, named `marks`, named `crops`, `deckNames` (the other names the decks use), `note`. Turn an entry into a Shot image with `shot()`:
```ts
import { proof, shot } from '../../data/proof';
shot(proof.nolaCalls, { marks: ['total', 'growth'] });
shot(proof.nolaKeyFirm, { crop: 'keyFirms', marks: ['firmRow'], alt: 'Google lists a New Orleans PI firm under key legal firms, rated 5.0 from 317 reviews' });
```
Stack a search box over its result in one Shot: `images={[shot(proof.nolaWtdQuery), shot(proof.nolaWtdRank, { marks: ['age'] })]}`.
Our own ranking, tall, with the ads collapsed to their label and nothing blurred (two bands of one capture):
```astro
<Shot tag="#1" images={[shot(proof.lseSerpTall, { crop: 'search', alt: '' }), shot(proof.lseSerpTall, { crop: 'result', marks: ['title'] })]} />
```
Your own marks: pass boxes (`{ l, t, w, h }`, % of the whole image) instead of names; measure them on the pixels.

### `ProofFigure`
A Shot with its proof caption: the quoted search in bold, then a line. Props: Shot's (`images`, `tag`, `tagSide` default right, `tagSmall`, `priority`), `query`, `queryMark`, `queryAbove` (search above the frame), `caption` or the default slot.
```astro
<ProofFigure tag="#1" query="jackknife truck accident Louisiana" caption="Ranked #1. A week on, Google's AI still cites it."
  images={[shot(proof.nolaJackknife, { marks: ['aiChip', 'result'] })]} />
```

### `BrowserShot`, `PhoneShot`
A website capture in a plain browser frame (grey bar, grey dots, no address), or a phone capture in a black phone frame. Both take Shot's props. `PhoneShot` adds `width` (max px, default 260).
```astro
<BrowserShot tag="Practice page" tagSmall tagSide="right" images={[shot(proof.nolaSiteCarAccidentPage)]} />
<PhoneShot width={220} tag="Our build" tagSmall tagSide="right" images={[shot(proof.nolaSiteHomePhone)]} />
```
The New Orleans site is dark and gold: the highlighter barely shows on it. Prefer a tag only. To overlap a phone on a desktop frame (web design hero), wrap both in your own grid in your group folder.

### `NumPair`
Big numbers: grey before, arrow, marked after (counts up once). Leave out `before` for one marked number.
Props: `before`, `after`, `beforeLabel`, `afterLabel`, `size` (`'md' | 'xl'`), `count`, `decorative` (default true: aria-hidden, so the heading or caption must say the same).
```astro
<NumPair before={9} after={23} beforeLabel="calls in six months before us" afterLabel="calls in three months with us" />
<NumPair after={43} afterLabel="calls in September 2026" size="xl" />
```

### `Q`
A literal Google search, quoted, in `<q data-no-check>`. Props: `text`, `mark` (words to highlight), `class`. Only for real searches.
```astro
<b><Q text="criminal defense lawyer near me" mark="near me" /></b>
```

### `SearchBox`
Searches typed into one plain search box. Props: `queries` (`{ text, mark? }[]`), `label` (read out), `caption`.
```astro
<SearchBox label="Searches people type after a charge" queries={[{ text: 'criminal defense lawyer near me', mark: 'near me' }, { text: '[charge] lawyer in [county]', mark: '[county]' }]} />
```

### `SearchPanel`
Two or three columns of searches, a hairline between columns. Column: `{ heading, queries, note?, placeholder?, strike? }` (`strike`: grey and struck through, for "skip"). Prop `headingTag`.
```astro
<SearchPanel columns={[{ heading: 'Workers', queries: [{ text: 'what type of lawyer do i need for wrongful termination', mark: 'what type of lawyer' }] },
  { heading: 'Employers', queries: [], placeholder: "employer-side searches from a client's market" }]} />
```

### `HairTable`
A small hairline table. Props: `head` (string[]), `rows` (cells: text, `{ q, mark? }` for a quoted search, `{ label, href }` for a link), `caption` (read out), `showCaption`.
```astro
<HairTable caption="Which page answers which search" head={['Search', 'The page that answers it']} rows={[[{ q: 'dui lawyer [city]' }, 'Your DUI page']]} />
```

## Text and people

### `Rows`
Plain rows with hairlines, never cards. Props: `items` (`{ title?, text? }[]`, `text` may hold a link), `variant`, `titleTag`.
- `plain`: small H3 over its line (the homepage's list).
- `inline`: "**The Map.** We run your profile..." in body size.
- `big`: title at H3 size (price drivers, terms).
- `numbered`: big Franklin 900 numerals (steps).
- `answer`: question at H3 size, the answer under it with a thin ink rule (vetting questions; never an accordion).
```astro
<Rows variant="numbered" items={[{ title: 'Book a ranking review.', text: 'In a free 30-minute call, Fahim looks at where you rank today.' }]} />
```

### `Face`, `Bio`, `src/data/people.ts`
`Face`: a person's cutout on the marker swipe. Props: `person` (`fahim`, `josh`), `size` (`'lg'` 460px, `'md'` 240, `'sm'` 132, `'xs'` 96), `priority`.
`Bio`: a person as a row (photo, name, role, a line); stacked Bios get a hairline between. Props: `person`, `size` (`'md' | 'sm' | 'xs'`), `headingTag`, `role`, `line` (write the deck's own words), default slot (a link).
```astro
<Bio person={fahim} size="md" role="Law firm SEO specialist" line="Over 6.5 years, Fahim has grown 67+ businesses online..."><p><a class="lse-link" href={fahim.href}>Read Fahim's background</a></p></Bio>
<Bio person={josh} line="A Texas-licensed attorney since 2008..." />
```

### `TrustLine`, `src/data/logos.ts`
"Law firms we work with" and the four logos. Props: `label`, `priority`. The only place firm names appear.

## Existing pieces you still use
`LeadForm` (own `idPrefix` and `label` per form), `CalendlyInline`, `Faq` with `faqSchema` (InnerPage's `faq` prop does it), `FinalCta` (last, once, `id="book"`), `PracticeLinks`, `Placeholder`, `Button`, `Shot`.

## Shared data
- `src/data/pricing.ts`: `included` (rows), `separateTotal`, `price`.
- `src/data/proof.ts`: every proof capture (22), with `shot()`.
- `src/data/people.ts`: `fahim`, `josh`.
- `src/data/logos.ts`: `trustLogos`.
- `src/data/pages.ts` (existing): `practicePages`, `servicePages`, `companyPages`.

## Image names the decks use for one file
| Deck name | Use |
|---|---|
| `nola-calls-sep-2026.webp`, `nola-calls-jun-oct-2026-sep.webp`, `calls-rudin-oct.webp` | `proof.nolaCalls` (the only 139 chart; its September point is already open at 43) |
| `calls-rudin.webp` (about-sm-fahim, "139") | `proof.nolaCalls`. LCME's `calls-rudin.webp` is a different capture (May to Sept, 119 calls) and is not ported |
| `elpaso-site-phone.webp`, `site-915-mobile.webp` | `proof.elpasoSiteMobile` |
| `p16-915-ai.webp`, `ai-915.webp` | `proof.elpasoAiDeadline` |
| `aio-tanker-main.webp` | `proof.nolaKeyFirm` |
| `aio-tanker-full.webp` | `proof.nolaTankerSerpFull` |
| `p16-tanker-ai.webp` | `proof.nolaTankerAi` (left column) |
| `tr-idiya-sales.webp`, `tr-breakthrough-traffic.webp` | `proof.idiyaSales`, `proof.breakthroughTraffic` |

## Not in the kit (build it in your group folder)
- The estate planning citation strip (three search boxes, each over a tight AI crop): compose `SearchBox`-style lines with `Shot` crops.
- The web design hero's phone overlapping the desktop frame: a small grid around `BrowserShot` and `PhoneShot`.
- Horizontal crops (the bankruptcy "August to October" chart crop): Shot crops bands of height only. Use `proof.nolaCalls` with `crop: 'chart'`, or port a cropped file and add it to `proof.ts`.
- The employment hero's two overlapping frames.
