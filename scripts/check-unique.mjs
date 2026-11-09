#!/usr/bin/env node
// Uniqueness check: after the build, fail if any LSE page shares long word runs with a Legal CMO Expert (LCME) page,
// repeats an LCME heading or button, uses an LCME-only phrase, or leaks an LCME ID or design token.
// Design: research/INFRA-REUSE.md section 7. Thresholds and word lists: scripts/unique-config.json.
//
//   node scripts/check-unique.mjs                     check dist/ (runs in `npm run build`)
//   node scripts/check-unique.mjs --report            also write .unique-report.json
//   node scripts/check-unique.mjs --refresh [distDir] rewrite scripts/data/lcme-snapshot.json from LCME's dist/
//
// LCME text comes from, in order: env LCME_DIST, the sibling LCME dist/ if it exists (local runs), else the
// committed snapshot (Workers Builds cannot see the sibling folder). Run --refresh whenever LCME ships.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'parse5';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const CONFIG_FILE = join(ROOT, 'scripts/unique-config.json');
const SNAPSHOT_FILE = join(ROOT, 'scripts/data/lcme-snapshot.json');
const DEFAULT_LCME_DIST = 'D:\\Freelancing\\Mine\\Legal CMO Expert\\site\\dist';
const SKIPPED_PAGES = new Set(['/404/', '/thank-you/']);

// ---------- Text extraction ----------
const SKIP_TAGS = new Set(['script', 'style', 'template', 'noscript', 'svg']);
const HEAD_TAGS = new Set(['h1', 'h2', 'h3']);
const LABEL_ATTRS = ['alt', 'aria-label', 'placeholder', 'title', 'data-cap', 'data-label'];

/** Lowercase words only. $ and % stay inside a number's token, and 1,500 becomes 1500. */
export function normalize(text) {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/'/g, '')
    .replace(/[^\p{L}\p{N}$%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export const tokensOf = (normalized) => (normalized ? normalized.split(' ') : []);

const attrOf = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const isSkipped = (node) =>
  SKIP_TAGS.has(node.tagName) || attrOf(node, 'hidden') !== undefined || attrOf(node, 'aria-hidden') === 'true' || attrOf(node, 'data-no-check') !== undefined;

function textOf(node) {
  if (node.nodeName === '#text') return node.value;
  if (!node.childNodes || (node.tagName && isSkipped(node))) return '';
  return node.childNodes.map(textOf).join(' ');
}

/**
 * One page, as three normalized fields plus the whole visible text.
 * body: <main> only, cut into segments at each h1 to h3 (so a hit can name its nearest heading).
 * heads: title, meta description, h1 to h3. labels: link and button text and the shown attributes.
 * full: everything visible, header and footer included, for the banned-phrase check.
 */
export function extractPage(html) {
  const doc = parse(html);
  const segments = [{ heading: '', text: [] }];
  const heads = [];
  const labels = [];
  const full = [];

  const walk = (node, inMain) => {
    if (node.nodeName === '#text') {
      full.push(node.value);
      if (inMain) segments[segments.length - 1].text.push(node.value);
      return;
    }
    if (!node.childNodes && !node.attrs) return;
    const tag = node.tagName;
    if (tag && isSkipped(node)) return;
    if (tag) {
      for (const name of LABEL_ATTRS) {
        const v = attrOf(node, name);
        if (v) labels.push(v);
      }
      if (tag === 'meta' && attrOf(node, 'name') === 'description') heads.push(attrOf(node, 'content') ?? '');
      if (tag === 'title') heads.push(textOf(node));
      if (tag === 'a' || tag === 'button') labels.push(textOf(node));
      if (HEAD_TAGS.has(tag)) {
        const t = textOf(node);
        heads.push(t);
        if (inMain) segments.push({ heading: t, text: [] });
      }
    }
    const here = inMain || tag === 'main';
    if (tag === 'title') return; // The title is not page text.
    for (const child of node.childNodes ?? []) walk(child, here);
  };
  walk(doc, false);

  const clean = (list) => [...new Set(list.map(normalize).filter(Boolean))];
  return {
    segments: segments.map((s) => ({ heading: normalize(s.heading), text: normalize(s.text.join(' ')) })),
    heads: clean(heads),
    labels: clean(labels),
    full: normalize([...heads, ...full, ...labels].join(' ')),
  };
}

// ---------- Corpus ----------
function walkFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkFiles(p) : [p];
  });
}

function pagePathOf(dist, file) {
  const rel = relative(dist, file).split(sep).join('/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
  return `/${rel.replace(/\.html$/, '')}/`;
}

/** Every built HTML page of a dist folder, as { path: extracted page }. */
export function readDist(dist) {
  const pages = {};
  for (const file of walkFiles(dist).filter((f) => f.endsWith('.html'))) {
    const path = pagePathOf(dist, file);
    if (SKIPPED_PAGES.has(path)) continue;
    pages[path] = extractPage(readFileSync(file, 'utf8'));
  }
  return pages;
}

/** What the snapshot keeps of an LCME page: normalized body text, headings and labels. */
export function toCorpusEntry(page) {
  return { body: page.segments.map((s) => `${s.heading} ${s.text}`.trim()).join(' '), heads: page.heads, labels: page.labels };
}

// ---------- Matching ----------
const hashOf = (tokens) => createHash('md5').update(tokens.join(' ')).digest('hex').slice(0, 14);

/** Replaces each allowed phrase with its own sentinel token, so no word run spans one. */
export function maskAllowed(normalized, allow) {
  let n = 0;
  let out = ` ${normalized} `;
  for (const phrase of allow.phrases) {
    const needle = ` ${phrase} `;
    for (let at = out.indexOf(needle); at >= 0; at = out.indexOf(needle)) {
      // Keep the trailing space, so a neighbouring allowed phrase still matches.
      out = `${out.slice(0, at)} __a${n++}__ ${out.slice(at + needle.length - 1)}`;
    }
  }
  for (const re of allow.patterns) out = out.replace(re, () => ` __a${n++}__ `);
  return out.trim();
}

function ngramIndex(tokens, n, label) {
  const map = new Map();
  for (let i = 0; i + n <= tokens.length; i++) {
    const key = hashOf(tokens.slice(i, i + n));
    if (!map.has(key)) map.set(key, label);
  }
  return map;
}

/** Positions where a window of n tokens is in the map, merged into maximal runs [start, endExclusive, label]. */
function runsOf(tokens, n, map) {
  const runs = [];
  for (let i = 0; i + n <= tokens.length; i++) {
    const label = map.get(hashOf(tokens.slice(i, i + n)));
    if (label === undefined) continue;
    const last = runs[runs.length - 1];
    if (last && i < last[1]) {
      last[1] = i + n;
    } else {
      runs.push([i, i + n, label]);
    }
  }
  return runs;
}

const jaccard = (a, b) => {
  const A = new Set(a);
  const B = new Set(b);
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both || 1);
};

export function prepareConfig(raw) {
  const norm = (list) => (list ?? []).map(normalize).filter(Boolean);
  return {
    ...raw,
    allow: {
      phrases: [...new Set(norm(raw.allowPhrases))].sort((a, b) => b.length - a.length),
      patterns: (raw.allowPatterns ?? []).map((p) => new RegExp(p, 'g')),
    },
    banned: norm(raw.bannedPhrases),
    watch: norm(raw.watchPhrases),
    thresholds: raw.thresholds,
  };
}

/**
 * lsePages: { path: extractPage() }. lcmePages: { path: { body, heads, labels } }.
 * Returns { errors, warnings, pages: [{ path, words, shared6, total6, pct }], sitewide }.
 */
export function compare(lsePages, lcmePages, rawConfig) {
  const config = prepareConfig(rawConfig);
  const t = config.thresholds;
  const errors = [];
  const warnings = [];

  // LCME side: masked tokens, then n-gram indexes.
  const lcmeTokens = [];
  const lcmeWordsByPath = [];
  for (const [path, entry] of Object.entries(lcmePages)) {
    const tokens = tokensOf(maskAllowed(entry.body, config.allow));
    lcmeWordsByPath.push([path, tokens]);
  }
  const map10 = new Map();
  const map7 = new Map();
  const set6 = new Set();
  for (const [path, tokens] of lcmeWordsByPath) {
    lcmeTokens.push(...tokens);
    for (const [k, v] of ngramIndex(tokens, 10, path)) if (!map10.has(k)) map10.set(k, v);
    for (const [k, v] of ngramIndex(tokens, 7, path)) if (!map7.has(k)) map7.set(k, v);
    for (const k of ngramIndex(tokens, 6, path).keys()) set6.add(k);
  }

  const lcmeLabels = new Map();
  for (const [path, entry] of Object.entries(lcmePages)) {
    for (const text of [...entry.heads, ...entry.labels]) if (!lcmeLabels.has(text)) lcmeLabels.set(text, path);
  }
  const lcmeHeads = Object.entries(lcmePages).flatMap(([path, e]) => e.heads.map((text) => [text, path]));
  const allowedWhole = new Set(config.allow.phrases);

  const pageStats = [];
  let sitewideShared = 0;
  let sitewideTotal = 0;

  for (const [path, page] of Object.entries(lsePages)) {
    if (SKIPPED_PAGES.has(path) || (config.exemptPages ?? []).some((e) => e.path === path)) continue;
    const legal = (config.legalPages ?? []).includes(path);

    // Body tokens, with a map from token position to the segment's heading.
    const tokens = [];
    const headingAt = [];
    for (const seg of page.segments) {
      const segTokens = tokensOf(maskAllowed(seg.text, config.allow));
      for (const tok of segTokens) {
        tokens.push(tok);
        headingAt.push(seg.heading);
      }
    }
    const describe = (run) => `${tokens.slice(run[0], run[0] + 25).join(' ')}${run[1] - run[0] > 25 ? ' ...' : ''}`;

    // 1. Shared runs.
    const minHard = legal ? t.legalRunWords : t.hardRunWords;
    const hard = runsOf(tokens, 10, map10).filter((r) => r[1] - r[0] >= minHard);
    for (const r of hard) {
      errors.push({ page: path, rule: 'shared-run', detail: `${r[1] - r[0]} words shared with ${r[2]}, near "${headingAt[r[0]] || '(start)'}": ${describe(r)}` });
    }
    if (!legal) {
      for (const r of runsOf(tokens, t.warnRunWords, map7)) {
        const len = r[1] - r[0];
        if (len >= t.hardRunWords) continue;
        if (hard.some((h) => r[0] < h[1] && h[0] < r[1])) continue;
        warnings.push({ page: path, rule: 'shared-run', detail: `${len} words shared with ${r[2]}: ${describe(r)}` });
      }
    }

    // 2. Share of 6-word windows found anywhere in LCME.
    let shared6 = 0;
    const total6 = Math.max(0, tokens.length - 5);
    for (let i = 0; i < total6; i++) if (set6.has(hashOf(tokens.slice(i, i + 6)))) shared6++;
    const pct = total6 ? (100 * shared6) / total6 : 0;
    const counted = !legal && tokens.length >= t.minWordsForPct;
    if (counted) {
      sitewideShared += shared6;
      sitewideTotal += total6;
      if (pct > t.fail6Pct) errors.push({ page: path, rule: 'shared-6grams', detail: `${pct.toFixed(2)}% of 6-word windows appear in LCME (fail above ${t.fail6Pct}%)` });
      else if (pct > t.warn6Pct) warnings.push({ page: path, rule: 'shared-6grams', detail: `${pct.toFixed(2)}% of 6-word windows appear in LCME (warn above ${t.warn6Pct}%)` });
    }
    pageStats.push({ path, words: tokens.length, shared6, total6, pct: Number(pct.toFixed(2)), counted });

    // 3. Headings and labels: exact matches and near duplicates.
    const mine = [...page.heads, ...page.labels];
    for (const text of mine) {
      if (tokensOf(text).length < t.minExactWords || allowedWhole.has(text)) continue;
      const from = lcmeLabels.get(text);
      if (from) errors.push({ page: path, rule: 'heading-or-label', detail: `"${text}" is also on LCME ${from}` });
    }
    for (const text of page.heads) {
      const words = tokensOf(text);
      if (words.length < 5 || allowedWhole.has(text)) continue;
      for (const [other, from] of lcmeHeads) {
        const o = tokensOf(other);
        if (o.length < 5 || other === text) continue;
        if (jaccard(words, o) > t.headingJaccard) {
          errors.push({ page: path, rule: 'near-duplicate-heading', detail: `"${text}" is almost "${other}" on LCME ${from}` });
          break;
        }
      }
    }

    // 4. Phrases only LCME uses, anywhere on the page (header, footer and labels too).
    const padded = ` ${page.full} `;
    for (const phrase of config.banned) {
      if (padded.includes(` ${phrase} `)) errors.push({ page: path, rule: 'banned-phrase', detail: `"${phrase}"` });
    }
    for (const phrase of config.watch) {
      if (padded.includes(` ${phrase} `)) warnings.push({ page: path, rule: 'watch-phrase', detail: `"${phrase}" is an LCME habit, check it is meant` });
    }
  }

  const sitewidePct = sitewideTotal ? (100 * sitewideShared) / sitewideTotal : 0;
  if (sitewideTotal && sitewidePct > t.sitewideFail6Pct) {
    errors.push({ page: '(sitewide)', rule: 'shared-6grams', detail: `${sitewidePct.toFixed(2)}% of all 6-word windows appear in LCME (fail above ${t.sitewideFail6Pct}%)` });
  }
  return { errors, warnings, pages: pageStats, sitewide: { shared6: sitewideShared, total6: sitewideTotal, pct: Number(sitewidePct.toFixed(2)) } };
}

// ---------- Leak scan ----------
/**
 * Files: [{ name, text }]. Returns [{ file, pattern }] for every hit. Case-insensitive.
 * leakAllowedContexts are stripped from every file. leakAllowedByFile strips its strings from the named dist files only.
 */
export function leakScan(files, rawConfig) {
  const patterns = rawConfig.leakPatterns.map((p) => ({ source: p, re: new RegExp(p, 'i') }));
  const lower = (list) => (list ?? []).map((s) => s.toLowerCase());
  const allowed = lower(rawConfig.leakAllowedContexts);
  const byFile = rawConfig.leakAllowedByFile ?? {};
  const hits = [];
  for (const { name, text } of files) {
    let scan = text.toLowerCase();
    for (const ctx of [...allowed, ...lower(byFile[name])]) scan = scan.split(ctx).join(' ');
    for (const { source, re } of patterns) {
      const m = re.exec(scan);
      if (m) hits.push({ file: name, pattern: source, found: m[0] });
    }
  }
  return hits;
}

const TEXT_FILE = /\.(html|js|mjs|css|json|xml|txt|svg|webmanifest)$/i;
export function readTextFiles(dist) {
  return walkFiles(dist)
    .filter((f) => TEXT_FILE.test(f))
    .map((f) => ({ name: relative(dist, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }));
}

// ---------- Main ----------
function loadCorpus() {
  const wanted = process.env.LCME_DIST || (existsSync(DEFAULT_LCME_DIST) ? DEFAULT_LCME_DIST : '');
  if (wanted && existsSync(wanted)) {
    const pages = Object.fromEntries(Object.entries(readDist(wanted)).map(([p, page]) => [p, toCorpusEntry(page)]));
    let note = `LCME text: live dist ${wanted} (${Object.keys(pages).length} pages)`;
    if (existsSync(SNAPSHOT_FILE)) {
      const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
      const distTime = statSync(join(wanted, 'index.html')).mtimeMs;
      if (new Date(snap.generatedAt).getTime() < distTime) note += '. WARNING: the committed snapshot is older than that dist, run: node scripts/check-unique.mjs --refresh';
    }
    return { pages, note };
  }
  if (!existsSync(SNAPSHOT_FILE)) {
    console.error('check-unique: no LCME text. Set LCME_DIST, or generate scripts/data/lcme-snapshot.json with --refresh <lcme dist>.');
    process.exit(1);
  }
  const snap = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8'));
  return { pages: snap.pages, note: `LCME text: committed snapshot of ${snap.generatedAt.slice(0, 10)} (${Object.keys(snap.pages).length} pages)` };
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--refresh') {
    const source = args[1] || process.env.LCME_DIST || DEFAULT_LCME_DIST;
    if (!existsSync(source)) {
      console.error(`check-unique: ${source} does not exist.`);
      process.exit(1);
    }
    const pages = Object.fromEntries(Object.entries(readDist(source)).map(([p, page]) => [p, toCorpusEntry(page)]));
    mkdirSync(dirname(SNAPSHOT_FILE), { recursive: true });
    writeFileSync(SNAPSHOT_FILE, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'legalcmoexpert.com dist/', pages })}\n`);
    console.log(`check-unique: wrote ${Object.keys(pages).length} LCME pages to scripts/data/lcme-snapshot.json`);
    return;
  }

  if (!existsSync(DIST)) {
    console.error('check-unique: dist/ not found. Run astro build first.');
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  const corpus = loadCorpus();
  const lse = readDist(DIST);
  const result = compare(lse, corpus.pages, config);
  const leaks = leakScan(readTextFiles(DIST), config).map((h) => ({ page: h.file, rule: 'leak', detail: `matches /${h.pattern}/ ("${h.found}")` }));
  const errors = [...result.errors, ...leaks];

  console.log(`check-unique: ${corpus.note}`);
  console.log(`check-unique: ${Object.keys(lse).length} LSE pages. Per page, shared 6-word windows (fail above ${config.thresholds.fail6Pct}%, sitewide ${config.thresholds.sitewideFail6Pct}%):`);
  for (const p of result.pages) {
    console.log(`  ${p.path.padEnd(40)} ${String(p.words).padStart(5)} words  ${p.counted ? `${p.pct.toFixed(2)}%` : 'not counted'}`);
  }
  console.log(`  sitewide: ${result.sitewide.pct.toFixed(2)}% (${result.sitewide.shared6} of ${result.sitewide.total6})`);
  for (const w of result.warnings) console.warn(`  warning ${w.page} [${w.rule}] ${w.detail}`);

  if (args.includes('--report')) {
    writeFileSync(join(ROOT, '.unique-report.json'), JSON.stringify({ ...result, errors, leaks }, null, 2));
  }
  if (errors.length) {
    console.error(`\ncheck-unique: ${errors.length} problem(s)\n`);
    for (const e of errors) console.error(`  ${e.page} [${e.rule}] ${e.detail}`);
    process.exit(1);
  }
  console.log(`check-unique: OK (${result.warnings.length} warning(s)).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
