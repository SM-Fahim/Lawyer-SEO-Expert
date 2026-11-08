#!/usr/bin/env node
// Tells IndexNow (Bing, Yandex and others) which URLs changed (plan section 9). Google doesn't use IndexNow, so
// for Google use Search Console's URL Inspection on the pages that matter.
//
// NOT RUN by anything: not by the build, not by Workers Builds. It only sends with --send. Without it, it prints
// what it would send and makes no request. It only ever talks to api.indexnow.org, never to the site.
//
// The key is set up: public/fddc9317cd86c71e7068d0f262251f0a.txt holds it. It isn't a secret. IndexNow reads it from the site to prove you
// own the domain. To change it, replace that file, push to main and check it shows on the live site.
//
// Then, from a fresh `npm run build`:
//   INDEXNOW_KEY=<key> node scripts/indexnow.mjs / /contact-us/        # shows the request
//   INDEXNOW_KEY=<key> node scripts/indexnow.mjs --send / /contact-us/ # sends it
//   INDEXNOW_KEY=<key> node scripts/indexnow.mjs --send --all                           # every URL in the sitemap
//
// Only URLs in the sitemap can go. Keep it to pages that really changed: repeat pings for unchanged pages can get
// a host ignored.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HOST = 'lawyerseoexpert.com';
const SITE = `https://${HOST}`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10_000;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

const stop = (message) => {
  console.error(`indexnow: ${message}`);
  process.exit(2);
};

const args = process.argv.slice(2);
const send = args.includes('--send');
const all = args.includes('--all');
const paths = args.filter((arg) => !arg.startsWith('--'));

function sitemapPaths() {
  const file = `${ROOT}dist/sitemap-0.xml`;
  if (!existsSync(file)) stop('dist/sitemap-0.xml is missing. Run npm run build first.');
  return [...readFileSync(file, 'utf8').matchAll(/<loc>https:\/\/lawyerseoexpert\.com([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const inSitemap = new Set(sitemapPaths());
const wanted = all ? [...inSitemap] : paths;
if (!wanted.length) stop('name the changed paths, or use --all. Nothing was sent.');

const notListed = wanted.filter((path) => !inSitemap.has(path));
if (notListed.length) console.warn(`Skipping, not in the sitemap:\n  ${notListed.join('\n  ')}`);
const urlList = wanted.filter((path) => inSitemap.has(path)).map((path) => `${SITE}${path}`);
if (!urlList.length) stop('no sitemap URLs left to send.');
if (urlList.length > MAX_URLS) stop(`${urlList.length} URLs is over the limit of ${MAX_URLS}.`);

const key = process.env.INDEXNOW_KEY ?? '';
if (send) {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) stop('--send needs INDEXNOW_KEY, 8 to 128 letters, digits or dashes. See the top of this file.');
  const keyFile = `${ROOT}public/${key}.txt`;
  if (!existsSync(keyFile) || readFileSync(keyFile, 'utf8').trim() !== key) stop(`public/${key}.txt must exist and hold only the key.`);
}

const body = { host: HOST, key: key || '<your key>', keyLocation: `${SITE}/${key || '<your key>'}.txt`, urlList };

if (!send) {
  console.log(`Dry run, nothing sent. Add --send to POST this to ${ENDPOINT}:\n${JSON.stringify(body, null, 2)}`);
  process.exit(0);
}

const response = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(30_000),
});
console.log(`IndexNow answered ${response.status} for ${urlList.length} URL(s). 200 or 202 means accepted.`);
process.exitCode = response.ok ? 0 : 1;
