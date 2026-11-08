# lawyerseoexpert.com

The site for Lawyer SEO Expert (LSE). An Astro static build served by one Worker (`lawyerseoexpert-site`). The back end is forked from the sister site legalcmoexpert.com (LCME). Everything visible is new and must not read or look like LCME. A new page goes live by being built: there is no list to add it to.

**Start here:** `docs/HANDOFF.md` (state, next steps, Cloudflare setup), then `docs/DECISIONS.md`. The plan and research are one folder up: `../PLAN.md`, `../research/` (read `INFRA-REUSE.md`, `LCME-FINGERPRINT.md`, `CLOUDFLARE-ZONE.md`).

## Commands

- `npm ci`: install. Node version is in `.node-version`.
- `npm run dev`: Astro dev server, pages only.
- `npm run local`: build and run the real Worker locally with `wrangler dev`.
- `npm run check`: type checks for pages, Worker and tests.
- `npm run build`: build to `dist/`, then `scripts/check-dist.mjs`, then `scripts/check-unique.mjs`. A failure blocks the deploy.
- `npm run check-unique`: only the uniqueness check, on an existing `dist/`. `npm run refresh-lcme-snapshot` rewrites `scripts/data/lcme-snapshot.json` from LCME's built `dist/` (do it whenever LCME ships, then commit).
- `npm run types`: regenerate Worker types after changing `wrangler.jsonc`.
- `npm run test`: Worker, router and tracker tests (`tests/worker/`, `tests/tracking/`), the router in real workerd (`tests/runtime/`), and the uniqueness script (`tests/unique/`). Local only, every outside service mocked. One worker.
- `npm run test:e2e`: build, then browser tests in `tests/e2e/` against a local `wrangler dev`. All outside traffic is blocked. One worker.

## Branches and deploys

Push to `main` deploys to production through Workers Builds. Any other branch gets a Preview URL. Work happens on a branch (this build started on `rebuild`), and the owner looks at the Preview first. Parallel sessions each use their own branch or worktree.

Undo: `npx wrangler rollback`, then revert the commit so the next deploy does not bring it back.

## Rules that never bend

1. Push to `main` changes the live site. The `lawyerseoexpert.com/*` route is commented out in `wrangler.jsonc` until launch day. DNS changes, the route, and retiring WordPress need the owner's OK on the exact change.
2. Never send requests straight to the origin IPs (216.183.246.221 and .223). Read live pages only through Cloudflare, at most 1 request per second.
3. Leave everything else in the Cloudflare account alone (other Workers, `status.`, `alerts.`, the `/intake` routes). `account_id` stays pinned in `wrangler.jsonc`.
4. `wrangler deploy` replaces a script's routes, so the config must list every route this Worker owns, and only those.
5. Never print or commit a secret. Use `wrangler secret put`. Read `.env` files by key name only.
6. Never enable Email Routing. Email Sending is onboarded on `notify.lawyerseoexpert.com` only, never `mail.` (the cPanel mail server) and never the apex.
7. Ask the owner before any live side effect: real leads, real Calendly bookings, cutover, deleting anything, anything that costs money.
8. Do not build, link or redirect anything under `/intake`. It belongs to another Worker (`rudin-intake-staging`). `check-dist` fails the build if you do.
9. Do not copy LCME. No LCME text, headings, buttons, IDs, colours or fonts. `check-unique` blocks it. Never weaken its thresholds to make a build pass: rewrite the copy.
10. Do not invent facts, quotes, names or numbers. Only the SEO and web prices the owner approved: from $2,000 a month and from $2,000 (`check-dist` enforces the dollar amounts).
11. Lead emails go to `fahim@wpseogeeks.com` and `fahim@legalcmoexpert.com`. Never `dev@legalcmoexpert.com`.

## Where things are

- `worker/`: the Worker (router, `/api/lead`, `/api/activity`, email, outbox, Reddit, GA4, Meta, broken-page log, crons). `wrangler.jsonc` configures it.
- `migrations/`: D1 schema, applied in order.
- `src/data/site.ts`: name, contact, the one Calendly URL, tracking IDs, schema. `src/data/redirects.ts`: every redirect. `src/data/features.ts`: sitewide add-ons.
- `src/features/`: tracking (the crown jewel), booking dialog. `src/scripts/forms.ts`, `calendly.ts`: form and booking logic.
- `src/components/`: `Seo`, `LeadForm`, `CalendlyInline`, `Faq` (bare, to be restyled). `src/layouts/Base.astro`: the shell.
- `scripts/`: `check-dist`, `check-unique` (with `unique-config.json` and `data/lcme-snapshot.json`), `verify-live`, `broken-report`, `indexnow`, `check-blocklists`, `seo-baseline`.
- `docs/`: `HANDOFF.md`, `DECISIONS.md`, `MANUAL-REVIEW.md`.

## Writing style

No em dashes. Marketing language, not legal jargon. Short plain sentences. No eyebrows or all-caps labels, no text to the right of an H2. Call-first CTAs. Qualified leads, never "signed cases". No gimmicks, no invented numbers or testimonials.
