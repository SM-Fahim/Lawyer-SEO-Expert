#!/usr/bin/env node
// Saves the live SEO fields of every known URL, so nothing is lost when a page moves off WordPress.
// Hard rule 2: one request at a time, at most 1 per second, always through Cloudflare by hostname.
// Never point this at the origin IP.
//
// Usage: node scripts/seo-baseline.mjs [--ttfb-only]
// Writes to docs/baselines/: seo-baseline.json, seo-baseline.md, wp-urls.txt, ttfb.json

import { mkdir, writeFile } from 'node:fs/promises';

const ORIGIN = 'https://lawyerseoexpert.com';
const OUT_DIR = new URL('../docs/baselines/', import.meta.url);
const USER_AGENT = 'lse-seo-baseline/1.0';
const MIN_GAP_MS = 1100;
const TTFB_SAMPLES = 15;
const TTFB_PATHS = ['/', '/contact-us/'];
const MAX_CONSECUTIVE_BLOCKS = 3;

// Every URL named in the plan (section 5), plus known oddities. Sitemap URLs are added at run time.
const SEED_PATHS = [
  '/', '/contact-us/', '/seo-pricing/', '/seo-pricing-page/', '/newsletter/', '/newslatter/', '/about/', '/about/sm-fahim/',
  '/about/josh-henderson/', '/lawyer-web-design-development/', '/careers/', '/privacy-policy/', '/terms-and-conditions/',
  '/seo-for-personal-injury-lawyers/', '/seo-for-personal-injury-lawyer/', '/personal-injury-lawyer-seo-2/',
  '/seo-for-bankruptcy-lawyers/', '/seo-for-criminal-defense-lawyers/', '/seo-for-dui-attorneys/', '/seo-for-dui-lawyer/',
  '/seo-for-employment-lawyers/', '/seo-for-environmental-law-attorneys/', '/seo-for-estate-planning-lawyers/',
  '/seo-for-family-lawyers/', '/seo-for-immigration-lawyers/', '/seo-for-medical-malpractice-lawyer/',
  '/seo-for-intellectual-property-lawyers/', '/crm-add/', '/crm-add-v2/', '/blog/', '/category/tips/',
  '/category/personal-injury-lawyer-seo/', '/category/criminal-defense-seo/', '/category/web-development-for-lawyers/',
  '/feed/', '/law-firm-names/', '/criminal-defense-seo-guide/', '/lawyer-domain-names/',
  '/crm-software-for-personal-injury-lawyers/', '/crm-software-for-personal-injury-law-firm',
  '/law-firm-social-media-post-ideas/', '/the-most-effective-system-to-get-personal-injury-clients-now/',
  '/web-development-for-lawyers-guide/', '/how-to-get-clients-as-lawyers/', '/pi-settlement-and-attorney-fee-calculator/',
  '/law-firm-ppc/', '/lawyer-content-writing/', '/register/', '/login/', '/this-does-not-exist/', '/favicon.ico', '/robots.txt',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastStart = 0;
let consecutiveBlocks = 0;

async function throttledFetch(url) {
  const wait = lastStart + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();

  const started = performance.now();
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xml;q=0.9,*/*;q=0.8' },
  });
  const ttfbMs = Math.round(performance.now() - started);
  const body = await response.text();

  // Stop rather than keep hitting a host that has started refusing us.
  if ([403, 429, 503].includes(response.status)) {
    consecutiveBlocks += 1;
    if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
      throw new Error(`Stopping: ${consecutiveBlocks} responses in a row refused, last ${response.status} on ${url}`);
    }
  } else {
    consecutiveBlocks = 0;
  }
  return { response, body, ttfbMs };
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
  }
  return attributes;
}

function parseHtml(html) {
  const head = html.split(/<\/head>/i)[0];
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseAttributes(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => parseAttributes(m[0]));
  const metaByName = (name) => metas.filter((m) => (m.name ?? '').toLowerCase() === name).map((m) => m.content ?? '');

  const social = {};
  for (const meta of metas) {
    const key = (meta.property ?? meta.name ?? '').toLowerCase();
    if (key.startsWith('og:') || key.startsWith('twitter:') || key.startsWith('article:')) social[key] = meta.content ?? '';
  }

  const schema = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return { unparsed: m[1].trim() };
    }
  });
  const schemaTypes = new Set();
  const collectTypes = (node) => {
    if (Array.isArray(node)) node.forEach(collectTypes);
    else if (node && typeof node === 'object') {
      if (node['@type']) [].concat(node['@type']).forEach((t) => schemaTypes.add(t));
      if (node['@graph']) collectTypes(node['@graph']);
    }
  };
  collectTypes(schema);

  const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const text = strip(html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' '));

  return {
    titles: [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)].map((m) => m[1].trim()),
    description: metaByName('description'),
    robots: metaByName('robots'),
    canonical: links.filter((l) => (l.rel ?? '').toLowerCase() === 'canonical').map((l) => l.href ?? ''),
    hreflang: links.filter((l) => l.hreflang).map((l) => ({ hreflang: l.hreflang, href: l.href })),
    siteVerification: metaByName('google-site-verification'),
    social,
    h1: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])),
    words: text ? text.split(' ').length : 0,
    schemaTypes: [...schemaTypes],
    schema,
    tailwindCdn: html.includes('cdn.tailwindcss.com'),
    redditPlugin: /reddit-conversion-tracking|rct_cid|redditstatic\.com\/ads\/pixel/i.test(html),
  };
}

async function sitemapPaths() {
  const found = new Set();
  const seen = new Set();
  const queue = [`${ORIGIN}/sitemap_index.xml`];
  const lists = {};
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const { response, body } = await throttledFetch(url);
    const locs = [...body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    lists[new URL(url).pathname] = { status: response.status, urls: locs };
    console.log(`${response.status} ${url} (${locs.length} entries)`);
    for (const loc of locs) {
      if (loc.endsWith('.xml')) queue.push(loc);
      else if (new URL(loc).hostname === new URL(ORIGIN).hostname) found.add(new URL(loc).pathname);
    }
  }
  return { paths: [...found], lists };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function measureTtfb() {
  const results = {};
  for (const path of TTFB_PATHS) {
    const samples = [];
    for (let i = 0; i < TTFB_SAMPLES; i += 1) {
      const { response, ttfbMs } = await throttledFetch(ORIGIN + path);
      samples.push({ ttfbMs, status: response.status });
    }
    const ok = samples.filter((s) => s.status === 200).map((s) => s.ttfbMs);
    results[path] = { medianMs: ok.length ? median(ok) : null, minMs: Math.min(...ok), maxMs: Math.max(...ok), okSamples: ok.length, samples };
    console.log(`TTFB ${path}: median ${results[path].medianMs} ms over ${ok.length} samples`);
  }
  return results;
}

const escapeCell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

function toMarkdown(records, capturedAt, sitemapOnly) {
  const rows = records.map((r) => {
    const canonicalOk = r.canonical?.length === 1 && r.canonical[0] === ORIGIN + r.path ? 'self' : (r.canonical?.join(' ') ?? '');
    return `| \`${r.path}\` | ${r.status} | ${escapeCell(r.location)} | ${escapeCell(r.titles?.join(' / '))} | ${escapeCell(canonicalOk)} | ${escapeCell(r.robots?.join(' '))} | ${r.words ?? ''} | ${escapeCell(r.schemaTypes?.join(', '))} | ${r.inSitemap ? 'yes' : ''} |`;
  });
  return [
    '# SEO baseline: live lawyerseoexpert.com',
    '',
    `Captured ${capturedAt} by \`scripts/seo-baseline.mjs\`, through Cloudflare, at most 1 request per second. Full values, including descriptions, social tags and schema, are in \`seo-baseline.json\`.`,
    '',
    `In the sitemap but not in the plan's URL list: ${sitemapOnly.length ? sitemapOnly.map((p) => `\`${p}\``).join(', ') : 'none'}.`,
    '',
    '| Path | Status | Redirects to | Title | Canonical | Robots | Words | Schema | In sitemap |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const capturedAt = new Date().toISOString();

  if (!process.argv.includes('--ttfb-only')) {
    const { paths: sitemap, lists } = await sitemapPaths();
    const sitemapSet = new Set(sitemap);
    const seedSet = new Set(SEED_PATHS);
    const sitemapOnly = sitemap.filter((p) => !seedSet.has(p));
    const allPaths = [...new Set([...SEED_PATHS, ...sitemap])];

    const records = [];
    for (const path of allPaths) {
      const url = ORIGIN + path;
      const { response, body, ttfbMs } = await throttledFetch(url);
      const type = response.headers.get('content-type') ?? '';
      const record = {
        path,
        status: response.status,
        location: response.headers.get('location') ?? '',
        contentType: type,
        xRobotsTag: response.headers.get('x-robots-tag') ?? '',
        cfCacheStatus: response.headers.get('cf-cache-status') ?? '',
        bytes: body.length,
        ttfbMs,
        inSitemap: sitemapSet.has(path),
      };
      if (type.includes('text/html') && body.length) Object.assign(record, parseHtml(body));
      records.push(record);
      console.log(`${record.status} ${path} ${record.location ? `-> ${record.location}` : ''} ${record.titles?.[0] ?? ''}`);
    }

    const write = (name, content) => writeFile(new URL(name, OUT_DIR), content);
    await write('seo-baseline.json', `${JSON.stringify({ capturedAt, origin: ORIGIN, sitemaps: lists, records }, null, 2)}\n`);
    await write('seo-baseline.md', toMarkdown(records, capturedAt, sitemapOnly));
    const working = records.filter((r) => r.status >= 200 && r.status < 400).map((r) => `${r.path} ${r.status}`);
    await write('wp-urls.txt', `${working.join('\n')}\n`);
    console.log(`Saved ${records.length} URLs, ${working.length} working.`);
  }

  const ttfb = await measureTtfb();
  await writeFile(new URL('ttfb.json', OUT_DIR), `${JSON.stringify({ capturedAt, from: 'owner PC, through Cloudflare', results: ttfb }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
