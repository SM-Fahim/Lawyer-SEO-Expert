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
