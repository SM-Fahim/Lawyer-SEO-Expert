#!/usr/bin/env node
// Checks every expected URL on one host: status, redirect, canonical and title (plan section 9).
// Run it after every stage. Run `npm run build` first, because pages are compared with dist/.
//
// Usage: node scripts/verify-live.mjs <host>
//
// Every page and sitemap file in dist/ must answer 200, every redirect must go where redirects.ts says,
// and the old WordPress paths must give the 404 page. Exits 1 if anything fails.
//
// Hard rule 2: one request at a time, at most 1 per second, by hostname. It refuses an IP address, and
// a hostname that resolves to one of the origin servers. Its user agent tells the Worker not to log
// these requests in broken_urls, because it asks for missing pages on purpose.
import { lookup } from 'node:dns/promises';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { isIP } from 'node:net';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { redirects } from '../src/data/redirects.ts';

const SITE_URL = 'https://lawyerseoexpert.com';
const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const ORIGIN_IPS = new Set(['216.183.246.221', '216.183.246.223']);
const USER_AGENT = 'lse-verify-live/1.0';
const MIN_GAP_MS = 1100;
const TIMEOUT_MS = 30_000;
const MAX_CONSECUTIVE_BLOCKS = 3;
// Not pages, but their addresses are public. /feed/ is the built feed.xml, served by the router.
const PLAIN_FILES = ['/feed/', '/favicon.ico', '/robots.txt', '/sitemap-index.xml', '/sitemap-0.xml'];
const WORDPRESS_PATHS = ['/wp-admin/', '/wp-login.php', '/wp-json/', '/xmlrpc.php', '/login/'];

const stop = (message) => {
  console.error(`verify-live: ${message}`);
  process.exit(2);
};

/** The hostname and port, or a refusal. URL turns tricks like 3627734749 or 0x7f.1 into plain IPs. */
function parseHost(input) {
  if (!input) stop('usage: node scripts/verify-live.mjs <host>');
  let url;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    stop(`"${input}" isn't a hostname.`);
  }
  const name = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(name)) stop(`refusing an IP address (${name}). Use the hostname, so the request goes through Cloudflare.`);
  return url.host;
}

const args = process.argv.slice(2);
const host = parseHost(args.find((arg) => !arg.startsWith('--')));

const addresses = await lookup(new URL(`https://${host}`).hostname, { all: true }).catch((error) => stop(`can't resolve ${host}: ${error.message}`));
if (addresses.some(({ address }) => ORIGIN_IPS.has(address))) stop(`${host} resolves to an origin server. Hard rule 2 forbids that.`);
if (!existsSync(DIST)) stop('dist/ not found. Run npm run build first.');

const decode = (text) =>
  text.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const titleOf = (html) => {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return match ? decode(match[1]) : null;
};
const canonicalOf = (html) => {
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/\brel=["']?canonical\b/i.test(tag)) return /\bhref=["']?([^"'\s>]+)/i.exec(tag)?.[1] ?? null;
  }
  return null;
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Every built page as path and file: dist/about/index.html is /about/. The 404 page has its own check. */
const builtPages = walk(DIST)
  .filter((file) => file.endsWith(`${sep}index.html`))
  .map((file) => {
    const rel = relative(DIST, file).split(sep).join('/');
    return { path: rel === 'index.html' ? '/' : `/${rel.slice(0, -'index.html'.length)}`, file };
  });

function pageExpectation({ file }) {
  const html = readFileSync(file, 'utf8');
  return { status: 200, title: titleOf(html), canonical: canonicalOf(html), why: 'built page' };
}

/** The sitemap's own files on workers.dev are Cloudflare's answer for robots.txt, so that one isn't ours there. */
function plainExpectation(path) {
  if (path === '/robots.txt' && host.endsWith('.workers.dev')) return { why: 'Cloudflare\'s own on workers.dev' };
  return { status: 200, why: 'built file' };
}

const homepage = builtPages.find(({ path }) => path === '/');
if (!homepage) stop('dist/index.html is missing. Run npm run build first.');

const expected = [
  ...builtPages.map((page) => [page.path, pageExpectation(page)]),
  ...PLAIN_FILES.map((path) => [path, plainExpectation(path)]),
  ...redirects.map((redirect) => [redirect.from, { status: redirect.status, location: redirect.to, why: 'redirects.ts' }]),
  ...WORDPRESS_PATHS.map((path) => [path, { status: 404, why: 'WordPress is gone' }]),
  ['/this-page-does-not-exist/', { status: 404, why: 'the 404 page' }],
  // A path without its slash is a permanent redirect, keeping the query string.
  ['/seo-pricing', { status: 301, location: '/seo-pricing/', why: 'adds the slash' }],
  ['/seo-pricing?rdt_cid=x', { status: 301, location: '/seo-pricing/?rdt_cid=x', why: 'adds the slash, keeps the click ID' }],
  // The ad path: parameters must still get the homepage, on every host.
  ['/?rdt_cid=x&utm_source=reddit', { ...pageExpectation(homepage), why: 'ad parameters stay on the homepage' }],
  // An old WordPress search link is the homepage now.
  ['/?s=1', { ...pageExpectation(homepage), why: 'no WordPress search any more' }],
];

/** Same host and path counts as a match, because a Preview answers with its own host. */
const samePlace = (location, target) => {
  const a = new URL(location, `https://${host}`);
  const b = new URL(target, `https://${host}`);
  return a.pathname === b.pathname && a.search === b.search && (a.host === host || a.host === new URL(SITE_URL).host);
};

let lastStart = 0;
async function get(path) {
  const wait = lastStart + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastStart = Date.now();
  const scheme = /^localhost(:|$)/.test(host) ? 'http' : 'https';
  const response = await fetch(`${scheme}://${host}${path}`, {
    redirect: 'manual',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = response.headers.get('content-type') ?? '';
  // Only HTML is worth reading, and an unread body must still be released.
  const body = type.includes('html') ? await response.text() : (await response.body?.cancel(), '');
  return { status: response.status, location: response.headers.get('location') ?? '', body, type, poweredBy: response.headers.get('x-powered-by') };
}

function compare(want, got) {
  const problems = [];
  if (want.status ? got.status !== want.status : got.status >= 500) problems.push(`status ${got.status}, expected ${want.status ?? 'below 500'}`);
  if (want.location && !samePlace(got.location, want.location)) problems.push(`goes to "${got.location}", expected "${want.location}"`);
  if (got.poweredBy) problems.push(`x-powered-by "${got.poweredBy}", so something other than the Worker answered`);
  if (got.status === 200 && got.type.includes('html')) {
    if (want.title && titleOf(got.body) !== want.title) problems.push(`title "${titleOf(got.body)}", expected "${want.title}"`);
    if (want.canonical && canonicalOf(got.body) !== want.canonical) problems.push(`canonical "${canonicalOf(got.body)}", expected "${want.canonical}"`);
  }
  return problems;
}

console.log(`verify-live: ${expected.length + 1} URLs on ${host}, one a second.\n`);

const failures = [];
let blocks = 0;

async function check(path, want) {
  let got;
  try {
    got = await get(path);
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    console.log(`FAIL  ${path}  ${error.message}`);
    return;
  }
  // A firewall or a challenge. Keep going and it could block the owner's IP.
  blocks = got.status === 403 || got.status === 429 || got.status === 503 ? blocks + 1 : 0;
  if (blocks >= MAX_CONSECUTIVE_BLOCKS) stop(`${MAX_CONSECUTIVE_BLOCKS} blocked answers in a row. Stopped, so the owner's IP stays safe.`);

  const problems = compare(want, got);
  const shown = `${got.status}${got.location ? ` -> ${got.location}` : ''}`;
  if (problems.length) {
    failures.push(`${path}: ${problems.join('; ')}`);
    console.log(`FAIL  ${path}  ${shown}  (${want.why})  ${problems.join('; ')}`);
  } else {
    console.log(`ok    ${path}  ${shown}  (${want.why})`);
  }
}

for (const [path, want] of expected) await check(path, want);

// D1 is reachable and no lead email is stuck.
const health = await get('/api/health').catch((error) => ({ status: error.message, body: '' }));
if (health.status !== 200) failures.push(`/api/health: ${health.status}`);
console.log(`${health.status === 200 ? 'ok   ' : 'FAIL '} /api/health  ${health.status}`);

console.log(failures.length ? `\nverify-live: ${failures.length} failed.` : '\nverify-live: all OK.');
for (const line of failures) console.log(`  ${line}`);
process.exitCode = failures.length ? 1 : 0;
