---
# /lawyer-web-design-development/ depth zone, v4 (content/V4-BRIEF.md): written from our own practice
# (research/EXPERTISE.md, item ids per section in content/v4/LEDGER.md).
# Slots the page fills: parts (the six parts beside the practice page capture); bands mid and price. The [OWNER Q4]
# items (build time, hosting terms, staff edits, the accessibility standard) stay off the page until answered.
summary: >-
  Lawyer web design, as we do it, plans a law firm's pages around what its clients search, builds each page to take
  the call on a phone, and moves the old site without losing what already ranks. We built the websites for two
  injury firms, and on both the work that mattered most came before launch: the page plan, the redirect map and the
  tracking.
reviewed: 2026-11-09
modified: 2026-11-09
faqHeading: What firms ask before a rebuild.
faqStyle: accordion
faq:
  - q: Can we keep our current domain name?
    a: >-
      Yes. A redesign can keep the domain and change only the page addresses, which keeps the move simpler. If a new
      domain is part of the plan, our post on [choosing a law firm domain name](/lawyer-domain-names/) covers the
      choice.
  - q: Who writes the words on the new site?
    a: >-
      Either your lawyers draft and we edit, or we write and your firm approves. Either way, we finish one page
      first and adjust it with you until it reads like your firm, and that page sets the voice for the rest. Nothing
      goes live until you or your ethics counsel sign off.
  - q: Will the new site show up in Google's AI answers?
    a: >-
      Nobody can promise a citation, but a page can be written for one. Before a page is written, we record what
      Google's AI answer says for its search and which sites it cites. The page then answers that question more
      precisely and more locally than the sources it found.
  - q: Should the new site have a blog?
    a: >-
      A feed of firm news is optional. What a firm site needs are three parts: local pages that win clients,
      education pages that answer wider questions and point readers to those local pages, and lawyer bio pages. Each
      guide links to the practice page it supports.
  - q: Do you build sites for firms outside the US?
    a: >-
      Yes, and the work happens remotely. Fahim has worked with businesses in four countries, including Ireland and
      New Zealand. Each country's regulator adds items to the page plan: for a solicitor's firm in England and
      Wales, that means the SRA's badge and the complaints details.
authorLine: >-
  Fahim has built more than 200 websites, across 6.5 years spent growing businesses online. For a Denver law firm,
  Fahim built a client portal and intake system, and still looks after its security.
sources:
  - url: https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes
    publisher: Google Search Central
    title: Site moves with URL changes
  - url: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_2_advertising/
    publisher: American Bar Association
    title: "Rule 7.2: Communications Concerning a Lawyer's Services: Specific Rules"
  - url: https://web.dev/articles/vitals
    publisher: web.dev (Google)
    title: Web Vitals
---

## Lawyer web design starts with the page plan

A law firm site has three jobs: be found for what clients search, look like a place to hire a lawyer at first glance, and make the call easy on a phone. So we plan the pages before anyone designs one, and every search worth winning gets a page of its own to land on.

Every site we build comes with the same six parts:

[slot parts]

[more "See what tops every practice page"]

A practice page has to look like a place to hire a lawyer before it reads like an article. Its top shows the service and the city, a short form or a call button, and the real lawyer's photo. The first paragraph answers the visitor's question, and on a phone a call bar stays in reach.

The homepage targets what the firm really is. A firm that takes every kind of injury case shouldn't have a homepage that says "car accident lawyer", so the homepage goes after the main search for its market and each practice page owns its own.

Every practice page uses the same building blocks, with different words inside them. A site looks templated when the text is copied, not when the layout is consistent.

[/more]

## Moving to a new site without losing rankings

Launch day is when a rebuild can lose what the old site earned. Every old address that ranks, gets visits or earns links needs a permanent redirect to its closest new page, the method [Google's guide to site moves](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes) sets out.

[steps]
1. **List every address the old site has.**
2. **Mark each page that earns something.**
3. **Pair each old page with its closest new one.**
4. **Build on a copy Google can't index.**
5. **Test every redirect, form and phone number.**
6. **Submit the new pages and watch the first weeks.**

[more "See how we run each step"]

1. The sitemap, the server logs and the content system each hold addresses the menu leaves out, such as old posts, lawyer bios and results pages.
2. Any page with search clicks, visits, links from other sites or tracked calls gets a close match on the new site. No page that brings in searchers loses its address without one, and nothing moves in bulk.
3. The pairs go in a sheet the firm keeps. Google warns against pointing many old pages at one unrelated page, such as the homepage.
4. Some page builders give every element a new ID when a page is copied and pasted, and the design falls apart. We move pages from the staging copy to the live site by copying the saved data directly, so the design survives.
5. Before a page is written, we check every link it will carry against the site plan. After launch, a script checks every link again, and a broken page that still draws searchers is redirected to the right one.
6. Each new page goes into the sitemap and is submitted to Google the day it goes live, and we tell Bing directly. Google's advice is to leave redirects in place for a year or more.

[/more]

## What every page carries from launch day

Three things are built in from the start rather than patched on later: the call tracking, the intake form and the disclosures the firm's bar expects.

**Tracking.** Google only ever sees the firm's real phone number, in the page code and the schema. A script swaps in the tracking number for human visitors alone.

**The form.** It asks for three things first and saves each answer the moment it's tapped. One firm's old intake form sent everything at the end, so a visitor who quit halfway left nothing behind.

**Disclosures.** The site names a responsible lawyer or firm with contact details, and results carry a disclaimer. [ABA Model Rule 7.2](https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_7_2_advertising/) asks for the first, and states set their own versions.

[more "See how the form and code are built"]

We replaced that old form with three fields and six short questions. A record is created in the firm's system as soon as someone enters a name and a phone number, before any question is answered. Should a later step ever break, the name, number and consent still get through. The extra questions can fail. The lead can't.

The schema describes the firm once, each office with its own real number and each lawyer with checked credentials. It's written into the page itself rather than added by a tag manager, since AI crawlers don't run scripts.

Every page shows who wrote it, which lawyer reviewed it and when it was last updated, and the markup says exactly the same. If the two disagree, the page isn't finished.

Text behind a "see more" control, like this one, stays in the page code, so Google still reads it. Phones and desktops get the same page.

[/more]

[more "See how we check badges and media mentions"]

Each trust badge gets one short line, and no two lines say the same thing. A badge that claims more than the lawyer holds gets corrected, even when the true version looks less impressive.

We check every media mention and speaking event against the original source. Even a wrong event name gets fixed before launch.

[/more]

[band mid]

## How a build runs with the lawyer

A build runs in a fixed order. A free call on what the current site ranks for comes first, then the written quote with the page plan, the pages, the design on a staging copy, and finally tracking, redirects and launch. Nothing goes live until you or your ethics counsel approve it.

The lawyer shapes the design as well as the words. Our first design for the El Paso firm was dark. The lawyer's team found it too stark and wanted the fee promise up in the header, so the palette, the font and the hero changed before launch.

[more "See what a homepage review can turn up"]

On one injury account, the crash numbers on the homepage were wrong, and some were higher than any year on record. We replaced them with the state's own figures. Those showed something nobody else was saying: more people died on foot than behind the wheel.

Because publishing state crash data can carry its own conditions, that change went to the lawyer for sign-off before it went live. A homepage speaks for the firm, so the lawyer has the last word on every figure it shows.

[/more]

## Speed, hosting and upkeep after launch

A fast page helps, though relevance still comes first. Google's [Web Vitals](https://web.dev/articles/vitals) set three targets: the main content loads within 2.5 seconds, a tap gets a response within 200 milliseconds, and the layout shifts by 0.1 or less. Most people looking for an injury lawyer search on a phone, so we test every page at common phone sizes before launch.

Hosting matters as much as speed. When one firm's web host went down for more than four hours, every page failed except the intake form, which we had hosted separately.

[more "See how we keep a site running"]

The same firm had been paying for a page cache that had never been switched on properly. Our fix: set the cache up properly, and keep the lead form on hosting of its own, so an outage at the host can't stop new leads.

After launch, a site needs software updates, new pages and regular checks that its forms and numbers still work. Our monthly [law firm SEO services](/law-firm-seo-services/) include that upkeep, along with improvements to the site's design and content.

[/more]

## What does a build cost, and when should you repair instead?

A build with us starts from $2,000, as one fixed quote in writing before any work starts. But a new site isn't always the answer, and this is how the two choices compare:

| What to weigh | Repair the site you have | Build a new one |
|---|---|---|
| When it fits | The site ranks and brings calls, and its problems sit in its words, speed or a few templates | The site can't hold the pages the firm needs, can't leave its builder, or fails on phones |
| What changes | Words, templates and speed, with every address kept | The design and the build, with a redirect for every page that earns |
| The main risk | Small, since no address moves | Launch day, if the redirect map misses a page |
| What it costs | Part of monthly SEO, from $2,000 a month | A fixed quote from $2,000, with monthly SEO as a separate choice |

Monthly SEO is a separate service. Our [law firm SEO pricing](/seo-pricing/) page lists what it includes.

[band price]
