#!/usr/bin/env node
// Static guardrails (plan section 9). `npm run build` runs this, so a failure blocks the deploy.
// It reads dist/ only and makes no network requests.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { plannedPaths } from '../src/data/pages.ts';
import { pendingRedirectTargets, redirects } from '../src/data/redirects.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SITE_URL = 'https://lawyerseoexpert.com';

// A launch build (STRICT_REDIRECTS=1) turns the pre-launch allowances below into failures: unbuilt redirect
// targets, links to planned pages that aren't built, and designed placeholders (data-placeholder).
const STRICT = !!process.env.STRICT_REDIRECTS;

// Text that must never ship, in any file type below. data-placeholder is checked separately: it may show on a
// Preview (designed placeholders the owner fills in), and fails a launch build.
const BANNED = ['lorem ipsum', 'wp-json', 'wpcf7', 'cdn.tailwindcss', 'fonts.googleapis.com', 'fonts.gstatic.com', 'datalayer'];
// A word start, because "assigned cases" on the custom software pages isn't this.
const BANNED_WORDS = [[/\bsigned case/, 'signed case']];
const TEXT_FILES = /\.(html|js|mjs|css|json|xml|txt|svg)$/i;

const redirectPaths = new Set(redirects.map((redirect) => redirect.from));
const planned = new Set(plannedPaths);
const plannedLinks = new Set();
const placeholderPages = new Map();

// ---------- Copy rules ----------
// Scope: the page title, the meta description, and <main>'s visible text, image alt text and aria-labels.
// The header, footer and dialogs aren't linted, and neither is anything that isn't shown. Text inside an
// element with data-verbatim is skipped. The other checks in this file still apply to it.
// LSE has no WordPress text to keep word for word, so there are no old-post exemptions here.
const OLD_POST_PATHS = new Set();

const COPY_RULES = [
  [/\bsigned[\s-]+cases?/gi, '"signed case(s)": say qualified leads'],
  [/—/g, 'em dash'],
  [/\bdominat\w*/gi, '"dominate" (cliche)'],
  [/\bAEO\b/g, '"AEO" jargon'],
  [/\bGEO\b/g, '"GEO" jargon'],
  [/\b100%\s+success/gi, 'unprovable claim (the old WordPress copy had it)'],
  [/\b8\.5x\b/gi, 'unprovable claim (the old WordPress copy had it)'],
  [/\bonly\s+1%\s+of\s+agencies/gi, 'unprovable claim (the old WordPress copy had it)'],
];
// Dollar amounts the owner approved (PLAN.md section 8, Q1): SEO from $2,000 a month, web development from $2,000.
// A page that needs another amount gets it in PRICES_BY_PAGE with a comment saying why.
const PRICES_EVERYWHERE = ['2,000'];
const PRICES_BY_PAGE = {};
const PRICE = /\$\s?(\d[\d,]*(?:\.\d+)?)\s?([KkMm]\b)?(\s?[–-]\s?\$?(\d[\d,]*(?:\.\d+)?)([KkMm]\b)?)?/g;
const COPY_EXCEPTIONS = {};

// A small tree of the built HTML. Astro's output is well formed, so this doesn't need a full parser,
// and the build stays free of an extra dependency.
const SKIPPED_ELEMENTS = new Set(['script', 'style', 'template', 'noscript', 'svg']);
const VOID_ELEMENTS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', copy: '©' };
const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
    return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  });

function parseTree(html) {
  const root = { tag: '#root', open: '', children: [] };
  const stack = [root];
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
  for (let m = token.exec(html); m; m = token.exec(html)) {
    const parent = stack[stack.length - 1];
    if (m[4] !== undefined) parent.children.push(m[4]);
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const at = stack.findLastIndex((node) => node.tag === tag);
      if (at > 0) stack.length = at;
    } else if (SKIPPED_ELEMENTS.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, token.lastIndex);
      if (close >= 0) token.lastIndex = close;
    } else {
      const node = { tag, open: m[0], children: [] };
      parent.children.push(node);
      if (!VOID_ELEMENTS.has(tag) && !m[3].endsWith('/')) stack.push(node);
    }
  }
  return root;
}
const elementsOf = (node) => node.children.filter((c) => typeof c !== 'string').flatMap((c) => [c, ...elementsOf(c)]);
const textOf = (node, skip) => node.children.map((c) => (typeof c === 'string' ? decode(c) : skip?.(c) ? '' : textOf(c, skip))).join(' ');
const hasClass = (node, name) => (attrValue(node.open, 'class') ?? '').split(/\s+/).includes(name);
const squash = (text) => text.replace(/\s+/g, ' ').trim();
const excerpt = (text, at, length) => squash(text.slice(Math.max(0, at - 40), at + length + 40));

function checkCopy(rel, path, html) {
  const main = elementsOf(parseTree(html)).find((node) => node.tag === 'main');
  if (!main) return;
  const verbatim = (node) => attr(node.open, 'data-verbatim');
  const outsideVerbatim = (node) => node.children.filter((c) => typeof c !== 'string' && !verbatim(c)).flatMap((c) => [c, ...outsideVerbatim(c)]);
  const elements = outsideVerbatim(main);
  const metaDescription = tags(html, 'meta').find((t) => attrValue(t, 'name') === 'description');
  const oldPost = false;
  const title = oldPost ? '' : decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const description = oldPost ? '' : decode(attrValue(metaDescription ?? '', 'content') ?? '');
  const alts = elements.filter((n) => n.tag === 'img').map((n) => decode(attrValue(n.open, 'alt') ?? ''));
  const labels = elements.map((n) => attrValue(n.open, 'aria-label')).filter(Boolean).map(decode);
  const visible = textOf(main, verbatim);

  const exceptions = COPY_EXCEPTIONS[path] ?? {};
  const lintText = (exceptions.phrases ?? []).reduce((text, phrase) => text.replace(phrase, ''), squash([title, description, visible, ...alts, ...labels].join(' ')));
  for (const [rule, why] of COPY_RULES) {
    for (const hit of lintText.matchAll(rule)) fail(rel, `banned copy, ${why}: ...${excerpt(lintText, hit.index, hit[0].length)}...`);
  }

  // Amounts in data-legal are the sample draft's legal facts, not our prices.
  const priceText = [textOf(main, (n) => verbatim(n) || attr(n.open, 'data-legal')), description, title].join(' ');
  const allowed = new Set([...PRICES_EVERYWHERE, ...(PRICES_BY_PAGE[path] ?? []), ...(exceptions.prices ?? [])]);
  const priceOf = (number, unit) => number.trim().replace(/[.,]$/, '').replace(/ /g, '') + (unit ?? '').toUpperCase();
  for (const hit of priceText.matchAll(PRICE)) {
    const amounts = [priceOf(hit[1], hit[2]), ...(hit[4] ? [priceOf(hit[4], hit[5])] : [])];
    for (const amount of amounts) {
      if (!allowed.has(amount)) fail(rel, `price ${amount} isn't allowed on this page (see PRICES_BY_PAGE): ...${excerpt(priceText, hit.index, hit[0].length)}...`);
    }
  }
}

// check.py stops at <main>. An em dash is wrong anywhere it can show, so this covers the rest: the shell and
// dialogs, attributes that show on screen (alt, captions, table labels), SVG text and JSON-LD. Text in
// data-verbatim stays exempt, and so does an old post's JSON-LD, which repeats its wording.
const SHOWN_ATTRIBUTES = ['alt', 'aria-label', 'title', 'placeholder', 'data-cap', 'data-label'];
function checkEmDash(rel, path, html) {
  const body = elementsOf(parseTree(html)).find((node) => node.tag === 'body');
  if (!body) return;
  const verbatim = (node) => attr(node.open, 'data-verbatim');
  const outsideVerbatim = (node) => node.children.filter((c) => typeof c !== 'string' && !verbatim(c)).flatMap((c) => [c, ...outsideVerbatim(c)]);
  const lint = (where, text) => {
    const at = text.indexOf('—');
    if (at >= 0) fail(rel, `em dash in ${where}: ...${excerpt(text, at, 1)}...`);
  };
  lint('the page outside <main>', textOf(body, (node) => verbatim(node) || node.tag === 'main'));
  for (const node of outsideVerbatim(body)) {
    for (const name of SHOWN_ATTRIBUTES) lint(`${name} on <${node.tag}>`, decode(attrValue(node.open, name) ?? ''));
  }
  for (const [svg] of html.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) lint('SVG', decode(svg));
  if (OLD_POST_PATHS.has(path)) return;
  for (const [, json] of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let text = json;
    try {
      text = JSON.stringify(JSON.parse(json));
    } catch {
      // Not valid JSON: the raw text is still worth checking.
    }
    lint('JSON-LD', decode(text));
  }
}
// ---------- End of copy rules ----------

/** Every id once per page: a repeat breaks labels, aria links and # links. Scripts and comments aren't markup. */
function checkDuplicateIds(rel, html) {
  const markup = html.replace(/<!--[\s\S]*?-->|<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
  const seen = new Set();
  for (const [tag] of markup.matchAll(/<[a-zA-Z](?:[^>"']|"[^"]*"|'[^']*')*>/g)) {
    const id = attrValue(tag, 'id');
    if (id === null) continue;
    if (seen.has(id)) fail(rel, `id "${id}" is used more than once`);
    seen.add(id);
  }
}

/** The lead email names the form it came from, so every form has to say. */
function checkSourceForm(rel, html) {
  for (const form of elementsOf(parseTree(html)).filter((node) => node.tag === 'form')) {
    const field = elementsOf(form).find((node) => node.tag === 'input' && attrValue(node.open, 'name') === 'source_form');
    if (!attrValue(field?.open ?? '', 'value')) fail(rel, `form has no source_form value: ${form.open}`);
  }
}

const errors = [];
const fail = (file, message) => errors.push(`${file}: ${message}`);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}(?:=(?:"([^"]*)"|'([^']*)'|([^\\s>]+)))?(?=[\\s/>])`, 'i'));
const attrValue = (tag, name) => {
  const m = attr(tag, name);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};
// Same list as worker/pagetype.ts. tests/tracking/pagetype.test.ts checks they match.
const PAGE_TYPES = ['service', 'pricing', 'booking', 'blog', 'company'];
const tags = (html, name) => html.match(new RegExp(`<${name}(?=[\\s/>])[^>]*>`, 'gi')) ?? [];

// The page's own URL: dist/about/index.html is /about/, dist/404.html is /404/.
function pagePath(file) {
  const rel = relative(DIST, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel.replace(/\.html$/, '')}/`;
}

function isBuilt(path) {
  // The router serves the RSS file at this address.
  if (path === '/feed/') return existsSync(join(DIST, 'feed.xml'));
  const clean = decodeURI(path).replace(/^\//, '');
  const candidates = [join(DIST, clean), join(DIST, clean, 'index.html')];
  return candidates.some((c) => existsSync(c) && statSync(c).isFile());
}

if (!existsSync(DIST)) {
  console.error('check-dist: dist/ not found. Run astro build first.');
  process.exit(1);
}

const allFiles = walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
const idsByPage = new Map(
  htmlFiles.map((f) => [pagePath(f), new Set([...readFileSync(f, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]),
);

for (const file of allFiles.filter((f) => TEXT_FILES.test(f))) {
  const rel = relative(DIST, file).split(sep).join('/');
  const text = readFileSync(file, 'utf8').toLowerCase();
  for (const word of BANNED) if (text.includes(word)) fail(rel, `contains banned text "${word}"`);
  for (const [rule, word] of BANNED_WORDS) if (rule.test(text)) fail(rel, `contains banned text "${word}"`);
}

for (const file of htmlFiles) {
  const rel = relative(DIST, file).split(sep).join('/');
  const html = readFileSync(file, 'utf8');
  const path = pagePath(file);
  const robots = tags(html, 'meta').find((t) => attrValue(t, 'name') === 'robots');
  const noindex = !!robots && /noindex/i.test(attrValue(robots, 'content') ?? '');

  // Everything built goes live, so a draft with open questions can't be merged.
  if (html.includes('data-draft')) fail(rel, 'still has open data-draft questions, and every built page goes live');

  const count = (re) => (html.match(re) ?? []).length;
  if (count(/<title[\s>]/gi) !== 1) fail(rel, 'needs exactly one <title>');
  if (tags(html, 'meta').filter((t) => attrValue(t, 'name') === 'description').length !== 1) fail(rel, 'needs exactly one meta description');
  if (count(/<h1[\s>]/gi) !== 1) fail(rel, 'needs exactly one <h1>');

  const canonicals = tags(html, 'link').filter((t) => attrValue(t, 'rel') === 'canonical');
  const expected = `${SITE_URL}${path}`;
  if (canonicals.length !== 1) fail(rel, 'needs exactly one canonical');
  else if (attrValue(canonicals[0], 'href') !== expected) fail(rel, `canonical should be ${expected}, found ${attrValue(canonicals[0], 'href')}`);


  // Every page needs a type for Meta's content_category. Base.astro requires it and the layouts set it.
  const pageType = attrValue(tags(html, 'html')[0] ?? '', 'data-page-type');
  if (!PAGE_TYPES.includes(pageType)) fail(rel, `<html data-page-type> must be one of ${PAGE_TYPES.join(', ')}, found ${pageType}`);

  // TODO(owner): once Meta's domain verification tag is in Base.astro, check it here on the homepage.

  // Noindex system pages (404, thank-you) are exempt from the tracker rule.
  if (!noindex && !html.includes('data-lse-tracker')) fail(rel, 'tracker is missing');

  for (const img of tags(html, 'img')) {
    // The zoom dialog's image gets its src, alt and size from the screenshot it opens.
    if (attr(img, 'data-zoom-img')) continue;
    for (const name of ['alt', 'width', 'height']) if (attrValue(img, name) === null) fail(rel, `image needs ${name}: ${img}`);
    const src = attrValue(img, 'src');
    if (src?.startsWith('/') && !isBuilt(src)) fail(rel, `image file missing: ${src}`);
  }

  for (const form of tags(html, 'form')) {
    if (attrValue(form, 'action') !== '/api/lead') fail(rel, `form must post to /api/lead: ${form}`);
    if ((attrValue(form, 'method') ?? '').toLowerCase() !== 'post') fail(rel, `form must use POST: ${form}`);
  }

  for (const a of tags(html, 'a')) {
    let href = attrValue(a, 'href');
    if (href === null) continue;
    href = href.replace(/&amp;/g, '&');
    if (href.startsWith(`${SITE_URL}/`) || href === SITE_URL) href = href.slice(SITE_URL.length) || '/';
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue; // External, mailto, tel.

    const [target, rawHash = ''] = href.split('#');
    // #:~:text=... is a browser text fragment, not an element's id. One post links to another this way.
    const hash = rawHash.startsWith(':~:') ? '' : rawHash;
    const linkPath = target.split('?')[0] || path; // "#x" points at this page.
    if (!linkPath.startsWith('/')) {
      fail(rel, `relative link: ${href}`);
      continue;
    }
    const samePage = !target;
    if (!samePage && !isBuilt(linkPath) && !redirectPaths.has(linkPath)) {
      // A planned page (src/data/pages.ts) can be linked before it's built, until launch.
      if (planned.has(linkPath) && !STRICT) plannedLinks.add(linkPath);
      else fail(rel, `internal link goes nowhere: ${href}`);
    }
    // Inner pages have no #book section. The booking dialog catches these links.
    if (samePage && hash === 'book' && html.includes('data-bookdlg')) continue;
    if (hash && idsByPage.has(linkPath) && !idsByPage.get(linkPath).has(hash)) fail(rel, `link target #${hash} is missing on ${linkPath}`);
  }

  const placeholders = (html.match(/\sdata-placeholder=/g) ?? []).length;
  if (placeholders) {
    if (STRICT) fail(rel, `still has ${placeholders} placeholder(s) (data-placeholder)`);
    else placeholderPages.set(path, placeholders);
  }

  checkCopy(rel, path, html);
  checkEmDash(rel, path, html);
  checkDuplicateIds(rel, html);
  checkSourceForm(rel, html);
}

// ---------- Sitemap and robots.txt (plan section 9) ----------
const SITEMAP_INDEX = '/sitemap-index.xml';
const ROBOTS_LINE = `Sitemap: ${SITE_URL}${SITEMAP_INDEX}`;
const locsIn = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => decode(m[1]));

function checkSitemap() {
  const indexFile = join(DIST, SITEMAP_INDEX);
  if (!existsSync(indexFile)) return fail('sitemap-index.xml', 'is missing');
  const index = readFileSync(indexFile, 'utf8');
  if (!/^<\?xml version="1\.0" encoding="UTF-8"\?><sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(index)) fail('sitemap-index.xml', 'has an unexpected start');

  if (index.includes('<lastmod>')) fail('sitemap-index.xml', 'has a lastmod, which would be the newest post\'s date, not the file\'s');
  const parts = locsIn(index);
  if (!parts.length) fail('sitemap-index.xml', 'lists no sitemap files');
  const listed = [];
  for (const part of parts) {
    if (!part.startsWith(`${SITE_URL}/`)) fail('sitemap-index.xml', `${part} isn't on the production host`);
    const rel = part.slice(SITE_URL.length);
    const file = join(DIST, rel);
    if (!existsSync(file)) {
      fail('sitemap-index.xml', `lists ${rel}, which wasn't built`);
      continue;
    }
    const xml = readFileSync(file, 'utf8');
    if (!/^<\?xml version="1\.0" encoding="UTF-8"\?><urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) fail(rel, 'has an unexpected start');
    if (!xml.trimEnd().endsWith('</urlset>')) fail(rel, 'is cut off');
    if (/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml)) fail(rel, 'has an unescaped &');
    listed.push(...locsIn(xml));
  }
  if (new Set(listed).size !== listed.length) fail('sitemap', 'lists a URL twice');

  // No page has a real modified date yet, so no URL may carry a lastmod. (Add post dates here if a blog ships.)
  for (const part of parts) {
    const rel = part.slice(SITE_URL.length);
    if (!existsSync(join(DIST, rel))) continue;
    if (readFileSync(join(DIST, rel), 'utf8').includes('<lastmod>')) fail(rel, 'has a lastmod, but no page has a real date yet');
  }

  const inSitemap = new Set(listed);
  for (const url of listed) {
    if (!url.startsWith(`${SITE_URL}/`) || !url.endsWith('/')) {
      fail('sitemap', `${url} isn't a production URL with a trailing slash`);
      continue;
    }
    const path = url.slice(SITE_URL.length);
    // A listed URL must answer 200. A redirect doesn't belong.
    if (redirectPaths.has(path)) fail('sitemap', `${path} is a redirect`);
    else if (!isBuilt(path)) fail('sitemap', `${path} isn't built, so it would be a 404`);
  }

  // Exactly the indexable pages: nothing noindex or draft in, nothing else left out.
  for (const file of htmlFiles) {
    const path = pagePath(file);
    const html = readFileSync(file, 'utf8');
    const robots = tags(html, 'meta').find((t) => attrValue(t, 'name') === 'robots');
    const hidden = (!!robots && /noindex/i.test(attrValue(robots, 'content') ?? '')) || html.includes('data-draft');
    const url = `${SITE_URL}${path}`;
    if (hidden && inSitemap.has(url)) fail('sitemap', `${path} is noindex or a draft, but it's listed`);
    if (!hidden && !inSitemap.has(url)) fail('sitemap', `${path} is indexable, but it's missing`);
  }
}

function checkRobots() {
  const file = join(DIST, 'robots.txt');
  if (!existsSync(file)) return fail('robots.txt', 'is missing');
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  if (!lines.includes(ROBOTS_LINE)) fail('robots.txt', `needs "${ROBOTS_LINE}"`);
  if (lines.filter((line) => /^sitemap:/i.test(line)).length !== 1) fail('robots.txt', 'needs exactly one Sitemap line');
  // Only WordPress's own block, which is what the live file has. A site selling AI search visibility must
  // not block crawlers, so anything wider needs the owner and a change here.
  const blocks = lines.filter((line) => /^disallow:/i.test(line) && line.split(':')[1].trim());
  if (blocks.length !== 1 || blocks[0] !== 'Disallow: /wp-admin/') fail('robots.txt', `only "Disallow: /wp-admin/" is expected, found ${JSON.stringify(blocks)}`);
  const agents = lines.filter((line) => /^user-agent:/i.test(line));
  if (agents.length !== 1 || agents[0] !== 'User-agent: *') fail('robots.txt', `only "User-agent: *" is expected, found ${JSON.stringify(agents)}`);
}

// A redirect runs before the built files. So its target has to be built on the same commit, and a built page
// can't be redirected, or nobody could reach it. That includes noindex pages like /thank-you/.
// /intake and /intake/* on this domain belong to another Worker (rudin-intake-staging), routed on the zone.
// This site must never build, link or redirect anything there (research/CLOUDFLARE-ZONE.md).
const INTAKE = /^\/intake(?:\/|$)/i;
function checkIntake() {
  for (const file of allFiles) {
    const rel = `/${relative(DIST, file).split(sep).join('/')}`;
    if (INTAKE.test(rel)) fail('dist', `${rel} is under /intake, which belongs to another Worker`);
  }
  for (const { from, to } of redirects) {
    if (INTAKE.test(from) || INTAKE.test(to)) fail('redirects.ts', `${from} to ${to} touches /intake, which belongs to another Worker`);
  }
}

function checkRedirectTargets() {
  const pending = new Set(pendingRedirectTargets);
  const waiting = [];
  for (const { from, to } of redirects) {
    if (isBuilt(from)) fail('redirects.ts', `${from} is a built page, so this redirect would hide it`);
    const target = to.split('?')[0];
    if (redirectPaths.has(target)) fail('redirects.ts', `${from} goes to ${to}, which is itself a redirect`);
    if (isBuilt(target)) {
      if (pending.has(target)) fail('redirects.ts', `${target} is built now, so remove it from pendingRedirectTargets`);
    } else if (pending.has(target)) {
      waiting.push(target);
    } else {
      fail('redirects.ts', `${from} goes to ${to}, which isn't built`);
    }
  }
  if (waiting.length) {
    console.warn(`check-dist: warning, ${new Set(waiting).size} redirect target(s) not built yet (listed in pendingRedirectTargets): ${[...new Set(waiting)].join(', ')}. Launch needs this list empty.`);
  }
  if (STRICT && waiting.length) fail('redirects.ts', 'pendingRedirectTargets must be empty for a launch build');
}

checkSitemap();
checkRobots();
checkRedirectTargets();
checkIntake();
// ---------- End of sitemap and robots.txt ----------

if (plannedLinks.size) {
  console.warn(`check-dist: warning, links to ${plannedLinks.size} planned page(s) not built yet (src/data/pages.ts). Launch needs them built: ${[...plannedLinks].sort().join(', ')}`);
}
if (placeholderPages.size) {
  console.warn(`check-dist: warning, placeholders still showing: ${[...placeholderPages].map(([page, n]) => `${page} (${n})`).join(', ')}. Launch needs none.`);
}

if (errors.length) {
  console.error(`check-dist: ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log(`check-dist: OK (${htmlFiles.length} HTML files, ${allFiles.length} files in dist).`);
