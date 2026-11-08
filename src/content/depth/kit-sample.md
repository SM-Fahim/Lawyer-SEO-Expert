---
# The /kit/ sample: every depth-zone piece once, in page order. It describes the pipeline itself, so it holds no
# claims about SEO beyond the one sourced line. Real pages copy their depth copy from content/v3/<slug>.md.
summary: >-
  This is a sample. A <dfn>depth zone</dfn> is the long, useful part of a service or practice page: it sits under
  the commercial top and answers what a firm owner asks before hiring. This sample shows each piece once, in page
  order. First come sections with a table, a callout, a quoted search, steps and a checklist. A mid-page band and
  open questions follow, then the sources and the author box. Real copy comes from each page's deck in content/v3.
reviewed: 2026-11-08
faqHeading: Sample questions about the depth zone
faq:
  - q: Why is every answer open?
    a: >-
      Nothing on a page is hidden, so each answer shows without a click. The FAQPage markup is built from these same
      items, so it never says more than the page does.
  - q: Where does the copy for a page live?
    a: >-
      In one Markdown file per page, named after the page, in the site's depth folder. The page reads that file and
      places the zone under its commercial top, so the copy never has to be retyped into the page.
  - q: What happens when a builder note is left in?
    a: >-
      The build fails and names the file. The same goes for a table with more than 4 columns, an unknown marker line
      and a marker with no matching slot.
authorLine: >-
  Fahim has spent 6.5 years growing businesses online and has ranked 50+ of them on Google. He built the SEO system
  a New Orleans PI firm runs on.
sources:
  - url: https://developers.google.com/search/docs/fundamentals/creating-helpful-content
    publisher: Google Search Central
    title: Creating helpful, reliable, people-first content
  - url: https://developers.google.com/search/blog/2023/08/howto-faq-changes
    publisher: Google Search Central blog
    title: Changes to HowTo and FAQ rich results
---

## What does a depth section hold?

A depth section answers its heading in the first sentence, then gives the reader something to use. This sample stands in for real copy, so read it for the shapes, not the words.

A table compares things row by row. On a phone each row stacks into labelled lines, as in the posts.

| Piece | How to write it | What the reader sees |
|---|---|---|
| Table | A Markdown table, 4 columns at most | Hairline rows, stacked on a phone |
| Checklist | `[checklist]` on the line above a bullet list | A check mark on each row |
| Steps | `[steps]` on the line above a numbered list | Big numerals, the bold lead as a title |
| Callout | A quote line that opens with a bold lead | A black rule on the left |

> **Nothing is hidden.** Every answer, table and list shows without a click. That is an owner rule for every page.

### A quoted search

A real search goes in a `<q data-no-check>` tag, such as <q data-no-check>criminal defense lawyer near me</q>, so the uniqueness check skips the words people type. A page can also show searches in a kit piece:

[slot searches]

Length follows the topic. Google says it has <mark>no preferred word count</mark> ([Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)).

## How does a builder drop the copy in?

A builder moves a deck's depth copy into the site in four steps.

[steps]
1. **Copy the depth copy.** Put the sections in `src/content/depth/<slug>.md`, and the summary, questions and sources in its front matter.
2. **Add the marker lines.** Mark each checklist and each set of steps, and add a slot line where the deck names a kit piece.
3. **Place the zone.** Put `DepthZone` under the commercial top and `FinalCta` after it, and pass the FAQ and schema to `InnerPage`.
4. **Check both widths.** Look at the page at 1440 and 390 pixels before it goes to the judge.

[band mid]

## What should a page check before it goes live?

A short checklist keeps every page honest. Tick each line before a page goes to the judge.

[checklist]
- Every claim comes from FACTS or a linked official source.
- No section takes more than about a quarter of the page.
- Each table has 4 columns or fewer and reads on a phone.
- Links to other agencies carry `rel="nofollow"`, like this [sample agency link](https://example.com/).

The domains that get `nofollow` are listed in `src/data/nofollow.ts`, so a builder never types the attribute by hand.
