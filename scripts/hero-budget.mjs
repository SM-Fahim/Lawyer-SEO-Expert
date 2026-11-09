#!/usr/bin/env node
// The hero budget for the 16 service and practice pages (PageHero layout="row"), measured on the built dist/.
// Loads each page at 1440x900, 1366x768 and 390x844 behind a tiny static server (no outside requests), and prints,
// in px from the top of the page (header included):
//   hero    the bottom of the hero's content (the row, trust row included)   budget 1440: <= 880
//   sect    the bottom of the hero section (its bottom padding included)            budget 1440: <= 880
//   btn     the bottom of the form's button                                   budget 1440: <= 760, 1366: <= 740
//   left    the bottom of the form column (card and "Prefer a call?")
//   right   the bottom of the proof column (the fog panel, trust row included)
//   slack   fog left above and below the proof inside its panel (a short capture is centred in it)
//   h1, lead   lines (H1: 2 at 1440, never more than 3; lead: 2 at most at 1440)
//   proof   phones: the proof's height (budget <= 220), and the order H1, lead, proof, form, trust
//   ovf     sideways overflow of the page
// Usage: node scripts/hero-budget.mjs [--shots] [slug ...]   (--shots also saves docs/shots/<slug>-<w>-first.png)
// Run `npm run build` (or `npx astro build`) first. Take the build lock: one browser at a time on this PC.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// HERO_DIST points at another built dist/ (read only), to compare with a branch before the change.
const DIST = process.env.HERO_DIST ?? join(ROOT, 'dist');
const args = process.argv.slice(2);
const SHOTS = args.includes('--shots');
const only = args.filter((a) => !a.startsWith('--'));
const PAGES = [
  'law-firm-seo-services', 'law-firm-seo-consultant', 'seo-pricing', 'lawyer-web-design-development', 'law-firm-ppc',
  'seo-for-bankruptcy-lawyers', 'seo-for-criminal-defense-lawyers', 'seo-for-dui-attorneys', 'seo-for-employment-lawyers',
  'seo-for-environmental-law-attorneys', 'seo-for-estate-planning-lawyers', 'seo-for-family-lawyers',
  'seo-for-immigration-lawyers', 'seo-for-intellectual-property-lawyers', 'seo-for-medical-malpractice-lawyer',
  'seo-for-personal-injury-lawyers',
].filter((s) => !only.length || only.includes(s));
const SIZES = [[1440, 900], [1366, 768], [390, 844]];
const BUDGET = { 1440: { hero: 880, btn: 760 }, 1366: { btn: 740 } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  let f = join(DIST, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream' });
  createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', () => r(undefined)));
const address = server.address();
const BASE = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
const rows = [];
let fails = 0;
try {
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.route('**/*', (route) => (route.request().url().startsWith(BASE) ? route.continue() : route.abort()));
    for (const slug of PAGES) {
      await page.goto(`${BASE}/${slug}/`, { waitUntil: 'load' });
      // Fonts, and every image in the first screen decoded, so the shots show what a reader sees.
      await page.evaluate(async () => {
        await document.fonts.ready;
        const imgs = [...document.images].filter((i) => i.getBoundingClientRect().top < window.innerHeight && i.offsetParent !== null);
        await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
      });
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => {
        const box = (el) => (el ? el.getBoundingClientRect() : null);
        const bottom = (el) => { const b = box(el); return b ? Math.round(b.bottom + window.scrollY) : null; };
        const top = (el) => { const b = box(el); return b ? Math.round(b.top + window.scrollY) : null; };
        const hero = document.querySelector('.lse-hero');
        const grid = hero?.querySelector('.lse-hero__grid');
        const act = hero?.querySelector('.lse-hero__act');
        const visual = hero?.querySelector('.lse-hero__visual');
        const trust = hero?.querySelector('.lse-hero__trust');
        const proof = visual?.firstElementChild;
        const lines = (el) => { if (!el) return null; const lh = parseFloat(getComputedStyle(el).lineHeight); return Math.round(el.getBoundingClientRect().height / lh); };
        // The proof's own height on a phone: its frames (capture, card or numbers), without the caption.
        const media = proof?.querySelector('.lse-shot, .m-swap, .ps-duo, .lse-pcard, .ppc-card, .lse-nums') ?? proof;
        const vs = visual ? getComputedStyle(visual) : null;
        const inner = visual && vs ? visual.getBoundingClientRect().height - parseFloat(vs.paddingTop) - parseFloat(vs.paddingBottom) : 0;
        return {
          hero: bottom(grid), sect: bottom(hero),
          btn: bottom(act?.querySelector('button[type="submit"]')),
          left: bottom(act), right: Math.max(bottom(visual) ?? 0, bottom(trust) ?? 0),
          slack: proof ? Math.round(inner - proof.getBoundingClientRect().height) : null,
          h1: lines(hero?.querySelector('h1')), lead: lines(hero?.querySelector('.lse-hero__lead')),
          proofH: media ? Math.round(media.getBoundingClientRect().height) : null,
          order: hero?.classList.contains('lse-hero--vfirst')
            ? [top(hero.querySelector('h1')), top(hero.querySelector('.lse-hero__lead')), top(visual), top(act), top(trust)]
            : [top(hero?.querySelector('h1')), top(hero?.querySelector('.lse-hero__lead')), top(act), top(trust), top(visual)],
          ovf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const b = BUDGET[w] ?? {};
      const notes = [];
      if (b.hero && m.hero > b.hero) notes.push(`hero > ${b.hero}`);
      if (b.hero && m.sect > b.hero) notes.push(`section > ${b.hero}`);
      if (b.btn && m.btn > b.btn) notes.push(`button > ${b.btn}`);
      if (w > 999 && Math.abs(m.left - m.right) > 40) notes.push('columns > 40 apart');
      if (w === 1440 && m.h1 > 2) notes.push(`H1 ${m.h1} lines`);
      if (w > 999 && m.h1 > 3) notes.push(`H1 ${m.h1} lines`);
      if (w === 1440 && m.lead > 2) notes.push(`lead ${m.lead} lines`);
      if (w < 600 && m.proofH > 220) notes.push('phone proof > 220');
      // Phones keep the order each page had: H1, lead, proof, form, trust (PPC: H1, lead, form, trust, proof).
      const ord = m.order.filter((y) => y !== null);
      if (w < 600 && !ord.every((y, i) => i === 0 || y > ord[i - 1])) notes.push('phone order');
      if (m.ovf > 0) notes.push(`overflow ${m.ovf}px`);
      fails += notes.length;
      rows.push({ slug, size: `${w}x${h}`, ...m, notes });
      if (SHOTS) await page.screenshot({ path: join(ROOT, 'docs', 'shots', `${slug}-${w}-first.png`) });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}

const pad = (v, n) => String(v ?? '-').padStart(n);
console.log(`${'page'.padEnd(36)} ${'size'.padEnd(9)} ${pad('hero', 5)} ${pad('sect', 5)} ${pad('btn', 5)} ${pad('left', 5)} ${pad('right', 5)} ${pad('slack', 5)} ${pad('h1', 3)} ${pad('lead', 4)} ${pad('proof', 5)} ${pad('ovf', 3)}  notes`);
for (const r of rows) {
  const desk = !r.size.startsWith('390');
  console.log(`${r.slug.padEnd(36)} ${r.size.padEnd(9)} ${pad(r.hero, 5)} ${pad(r.sect, 5)} ${pad(r.btn, 5)} ${pad(r.left, 5)} ${pad(desk ? r.right : '', 5)} ${pad(desk ? r.slack : '', 5)} ${pad(r.h1, 3)} ${pad(r.lead, 4)} ${pad(desk ? '' : r.proofH, 5)} ${pad(r.ovf, 3)}  ${r.notes.join('; ') || 'ok'}`);
}
console.log(fails ? `\n${fails} budget miss(es).` : '\nEvery page is inside the budget.');
process.exitCode = fails ? 1 : 0;
