# Tracking

What tracks lawyerseoexpert.com, where each account lives, and how to check it. Set up on 2026-11-09. The code is the same as LCME's (forked), so how the tracker, the Worker and the dedupe work is in LCME's `site/docs/tracking.md`. This file holds what is specific to LSE. Public IDs only. Secrets are listed by name, never by value.

## At a glance

| Tool | Account | Public ID | Set where | Secret (Worker) |
|---|---|---|---|---|
| GA4 | Google Analytics account "Lawyer SEO Expert" (`326832216`), property "Lawyer SEO Expert" (`456059903`), web stream `https://lawyerseoexpert.com` (`8608218757`). Signed in as fahim@wpseogeeks.com (`authuser=1`). | `G-YCNP1LPT5W` | `src/data/site.ts` `ga4MeasurementId`, `wrangler.jsonc` `vars.GA4_MEASUREMENT_ID` | `GA4_API_SECRET` |
| Google tag gateway | Cloudflare zone `lawyerseoexpert.com`, Web tag management | GTM container `GTM-P95KL5K3`, path `/analytics` | The zone, not this repo | None |
| Google Tag Manager | GTM account "Lawyer SEO Expert", container `lawyerseoexpert.com` | `GTM-P95KL5K3` (Google tag `G-YCNP1LPT5W`, `GT-M3LZFJCW`) | tagmanager.google.com | None |
| Meta | Business portfolio "lawyerseo_expert" (`1200836201223572`), dataset "Lawyer SEO Expert" | `1120676457364234` | `src/data/site.ts` `metaPixelId`, `wrangler.jsonc` `vars.META_PIXEL_ID` | `META_CAPI_TOKEN` |
| Meta domain | Same portfolio, Brand safety, Domains: `lawyerseoexpert.com` (domain ID `2083541662365948`) | Meta tag `facebook-domain-verification` | `src/layouts/Base.astro`, every page's `<head>` | None |
| Reddit | Old Reddit Ads account `hx7ja4uz0lm1` (not LCME's new one) | Pixel `a2_hx7ja4uz0lm1` | `src/data/site.ts` `redditPixelId`, `wrangler.jsonc` `vars.REDDIT_PIXEL_ID` | `REDDIT_CAPI_TOKEN` |
| Search Console | fahim@wpseogeeks.com (`/u/1/`) | Domain property `sc-domain:lawyerseoexpert.com`, plus URL-prefix `https://lawyerseoexpert.com/` | DNS TXT at the apex (three `google-site-verification` records, keep them) | None |
| Bing Webmaster Tools | Not set up yet (see below) | | | |

Previews never track: the `previews` block in `wrangler.jsonc` keeps every pixel and GA4 ID blank.

## GA4

- **Reused, not created.** The property is the one WordPress used, so the history stays. It is used only by this domain. The Rudin intake under `/intake` (another Worker, `rudin-intake-staging`) also sends its `gr_*` events here, with three custom dimensions of its own. Leave those alone.
- **Page views** come from the Google tag, which Cloudflare's tag gateway injects at the edge for browser requests and serves from `/analytics/`. The site never loads `gtag.js` itself. The gateway was already on for the zone before the move, with "Set up tag" on, so page views carry on through the cutover with no change.
- **Conversions** come only from the Worker, through the Measurement Protocol (`worker/ga4.ts`), once each through D1 table `ga4_sent`: `generate_lead` (`lead_id`, `source_form`, `page_location`) from `/api/lead`, and `schedule_call` (`booking_id`) from `/api/activity` on a Calendly booking. Also `booking_dialog_open` and `exit_offer_shown`, not key events.
- **The GTM container** holds the GA4 page tag, the Rudin intake tag, and three old WordPress tags (`track__bookameeting`, `track__contactus`, `track__homepage`). Those fire only on URLs with `?bookameeting`, `?contactus` or `?performanceaudit`, which the new site never makes, so they do nothing. No Meta or Reddit tags are in the container, so nothing doubles the site's own pixels.
- **Admin, done 2026-11-09:** `calendly.com` on the unwanted referrals list (Google tag settings). Custom dimension "Source form", event scope, parameter `source_form`. Data retention was already 14 months for event and user data. Enhanced measurement: form interactions are off, so GA4 makes no form events of its own. Page views, scrolls, outbound clicks, site search, video and file downloads stay on.
- **Existing key events:** `gr_game_complete` and `gr_lead_start` (Rudin intake). `purchase` is listed, not starred.
- **Measurement Protocol secrets:** one already exists, "PixelYourSite", made by the WordPress plugin. Leave it until WordPress is retired. The Worker gets its own.

## Meta

- **Created 2026-11-09:** dataset "Lawyer SEO Expert" in the "lawyerseo_expert" portfolio (`1200836201223572`), which owns the Facebook Page "Lawyer SEO Expert" (`343618282176621`, facebook.com/LawyerSEOExpert). The owner's rule: the dataset lives with the brand's Page. No LSE pixel existed before: WordPress never loaded one.
- **Unused:** an earlier dataset `1127372726702074`, also "Lawyer SEO Expert", sits in the "Legal CMO Expert" portfolio. It was made first, then replaced the same day. Nothing sends to it. It isn't deleted.
- **Settings, as LCME:** "Conversions API with Meta" is not connected (the box that connects every dataset in the portfolio was unticked at creation, so the portfolio setting stayed as it was), automatic events off, automatic advanced matching off. Not connected to an ad account yet: the portfolio has one, "Lawyer SEO Expert" (`1061178799010392`), to connect when LSE runs Meta ads.
- **Other assets in the portfolio:** the dataset "Ergonomc Website" (`456625177524240`) belongs to a client. Leave it alone.
- **Domain:** `lawyerseoexpert.com` was first added to the Legal CMO Expert portfolio, then removed there and added to lawyerseo_expert (domain ID `2083541662365948`), because Meta allows a domain in one portfolio only.
- **Events:** PageView, ViewContent (with `content_category`), Lead and Schedule, from the Pixel and the Worker with one event ID. BookingDialogOpened from the Worker only.
- **Test:** open a page with `?meta_test=<code>`, the code from Events Manager, Test events. That visitor's server events go with `test_event_code`.

## Reddit

- The pixel is the one the WordPress plugin used. The Worker's token is the plugin's own (key `reddit_access_token_law` in the plugin's `.env`). Don't revoke or regenerate it.
- **Overlap:** after the cutover WordPress no longer serves the apex, so its plugin stops firing on its own. WordPress was not changed. Once it is retired, nothing else uses that token.

## Search Console and Bing

- Search Console already has the Domain property, verified by DNS. No TXT record was added. The old Rank Math sitemaps (`sitemap_index.xml`, `page-sitemap.xml`, `post-sitemap.xml`) are still listed. They 301 to `/sitemap-index.xml` after the cutover (`src/data/redirects.ts`), so leave them.
- Bing: signing in with fahim@wpseogeeks.com through Google showed a first-time consent screen, so that login has no Bing Webmaster account. Which account to use is the owner's choice.
- IndexNow runs from `scripts/indexnow.mjs` (the launch steps).

## How to check it works

- **Automated, all mocked:** `npm run test` and `npm run test:e2e`. The tracking e2e specs (forms, tracking, Meta) from LCME are not ported yet (HANDOFF step 6). Only the skeleton spec runs.
- **GA4 payload:** a payload shaped like `buildPayload()`'s, with `generate_lead`, `schedule_call` and `campaign_details`, went to `https://www.google-analytics.com/debug/mp/collect` for `G-YCNP1LPT5W` on 2026-11-09 and came back with no validation messages. The validation endpoint records nothing. It was sent with a placeholder secret, so it proves the payload, not the secret.
- **GA4 with the real secret:** set `GA4_DEBUG` to `true` on the Worker for a moment, send a test lead, and read `ga4_debug` in `wrangler tail`. Unset it after. Or look for `generate_lead` in Realtime after the launch agent's test lead.
- **Live page, after launch:** open `https://lawyerseoexpert.com/?notrack=0` and look in the network requests for: `/analytics/` collect with `en=page_view` and `tid=G-YCNP1LPT5W`; `facebook.com/tr` with `ev=PageView` and `id=1120676457364234`; Reddit `PageVisit` for `a2_hx7ja4uz0lm1`; and `POST /api/activity`. On `lawyerseoexpert-site.fahim-afd.workers.dev` without `?pixeltest=1`, none of these may fire.
- **Secrets set:** `npx wrangler secret list` shows names only. Expect `GA4_API_SECRET`, `META_CAPI_TOKEN`, `REDDIT_CAPI_TOKEN`.

## Known gap

LSE and LCME share one Calendly event. Each site's own counts (D1 `bookings`, GA4, Reddit, Meta) split cleanly, because each booking is counted by the site it happened on. Calendly itself does not say which site a booking came from: an untagged visit shows only the referring site, or nothing. A separate LSE event type fixes this (`docs/MANUAL-REVIEW.md`).

## Left to do

Owner, before or at launch:
1. GA4: Admin, Data streams, Website, Measurement Protocol API secrets, Create, nickname "Cloudflare Worker". Then set it: `npx wrangler secret put GA4_API_SECRET` and paste at the prompt.
2. Meta: Events Manager, switch the portfolio (top right) to **lawyerseo_expert**, Datasets, "Lawyer SEO Expert" (`1120676457364234`), Settings, Conversions API, Set up direct integration, "Set up with Dataset Quality API" (the owner's choice: the same events, plus match-quality scores readable by API), Generate access token. Direct link: `https://business.facebook.com/events_manager2/list/dataset/1120676457364234/settings?business_id=1200836201223572`. Then `npx wrangler secret put META_CAPI_TOKEN`.
3. Reddit: `npx wrangler secret put REDDIT_CAPI_TOKEN`, pasting the value of `reddit_access_token_law` from the plugin's `.env` without the quotes.
4. Run `npx wrangler secret list` and check all three names are there.

After launch:
1. Meta: Business settings in the lawyerseo_expert portfolio, Brand safety, Domains, `lawyerseoexpert.com`, Verify domain (after the deploy that carries the new tag).
2. Search Console: submit `https://lawyerseoexpert.com/sitemap-index.xml` for `sc-domain:lawyerseoexpert.com`.
3. Bing Webmaster Tools: the owner picks the account, imports `lawyerseoexpert.com` from Search Console, then submits the same sitemap.
4. GA4: once `generate_lead` and `schedule_call` show in Admin, Events, Recent events, star both as key events. They can't be added before Google has seen them.
5. Check the live page's network requests (above), and that `/intake` still gets its own Worker.
6. Meta: after a day of traffic, check Event Match Quality. Connect the dataset to an ad account when LSE runs Meta ads.
7. When WordPress is retired, with the owner's OK: delete the "PixelYourSite" GA4 secret. Keep the Reddit token, because the Worker uses the same one.
