# Manual review: owner questions that are not blocking

- LSE uses the same Calendly event as LCME (`connect-with-fahim/schedule-call`); a separate "Ranking review" event type would keep bookings apart. When it exists, change the single URL in `src/data/site.ts` and remove the `leakAllowedContexts` entry and the `connect-with-fahim` and `schedule-call` leak patterns' exception in `scripts/unique-config.json`.
- GA4: does LSE get its own property and measurement ID? Blank means GA4 is off.
- Meta: does LSE get its own dataset and domain verification tag? Blank means Meta is off.
- Reddit: the old WordPress plugin and the Worker both send for pixel `a2_hx7ja4uz0lm1` until the plugin is retired, so Page Visits double around cutover.
- The `dev.` and `dms.` subdomains return 526 today. Retire their DNS after launch? (Needs the owner's OK.)
- `hello@lawyerseoexpert.com` must exist as a cPanel mailbox or forwarder before the site shows it.
- The `/category/*` pages should redirect to `/blog/` once the blog exists (commented out in `redirects.ts`).
- Should `/about/` redirect to `/about/sm-fahim/` if no real About page is written?
- `/law-firm-ppc/` has no real Google Ads capture yet (the hero shows example search terms). To collect from the owner, each with the client's permission: (1) a client's search terms report, redacted, with wasted searches blocked; (2) one live ad we wrote, shown on Google, with the landing page it points to; (3) a dated US Google results page for a practice search showing the Sponsored block, every firm blurred.
- `/seo-for-employment-lawyers/`: the Employers column shows three example searches ("how to fire an employee legally", "employee filed eeoc complaint what now", "employment lawyer for small business"), captioned "Example searches.", with no volumes. Replace them with real employer-side searches from a client's market once one is collected.

## Practice pages, set B: placeholders removed on the judge's ruling (2026-11-08), to collect later

- `/seo-for-estate-planning-lawyers/`, name-search section: a real Google search for a planning firm's own name, with the firm's permission, before our work, with the item that needed fixing first marked. The section shows its three rows only until then.
- `/seo-for-immigration-lawyers/`, two-languages section: four real Spanish searches for the same case types, from a keyword tool (US, Spanish), checked by a fluent speaker. For now the Spanish column shows three example searches the judge supplied, captioned "Example searches." Replace them with keyword-tool searches when there are some.
- `/seo-for-immigration-lawyers/`, trust section: the foot of a real case-type page showing the attorney block (name, bar admission, check link), from a client who agrees, or a clearly labelled sample. The section shows its three rows only until then.
- `/seo-for-environmental-law-attorneys/`, demand check: a real demand table from a firm's first review (issue, monthly searches, who searches), with permission. The table now shows issues and searchers only, and the line under it says Fahim pulls the real monthly numbers on the review.
