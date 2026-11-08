// Unit tests for scripts/check-unique.mjs: a fixture that must fail and one that must pass.
// Run with: node --test tests/unique/
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compare, extractPage, leakScan, normalize, toCorpusEntry } from '../../scripts/check-unique.mjs';

const config = JSON.parse(readFileSync(new URL('../../scripts/unique-config.json', import.meta.url), 'utf8'));

let counter = 0;
const page = (title, h2, body, extra = '') =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="Description number ${counter++} for ${title}."></head>` +
  `<body><header><a href="/">Home link ${counter}</a></header><main><h1>${title}</h1><h2>${h2}</h2><p>${body}</p>${extra}</main><footer>Footer text</footer></body></html>`;

// A long run of distinct words, built from an index so nothing repeats.
const words = (seed, n) => Array.from({ length: n }, (_, i) => `w${seed}x${i}`).join(' ');

const lcme = {
  '/hire/': toCorpusEntry(extractPage(page('Hire a thing', 'How the thing works', `${words('a', 400)} we answer every call within a minute and then some more words`))),
};

test('normalize: case, quotes, numbers', () => {
  assert.equal(normalize('Don\u2019t pay $1,500 now!'), 'dont pay $1500 now');
});

test('extractPage: main text only for body, hidden and script skipped, labels and heads collected', () => {
  const p = extractPage(page('T', 'H', 'visible words', '<div hidden>secret</div><script>var x=1</script><button aria-label="Do it">Go</button>'));
  const body = p.segments.map((s) => s.text).join(' ');
  assert.match(body, /visible words/);
  assert.doesNotMatch(body, /secret|var x/);
  assert.doesNotMatch(body, /footer text/);
  assert.ok(p.labels.includes('do it') && p.labels.includes('go'));
  assert.ok(p.heads.includes('h'));
});

test('a page that copies a 12 word run from LCME fails with the run and the heading', () => {
  const copied = words('a', 400).split(' ').slice(100, 112).join(' ');
  const lse = { '/x/': extractPage(page('Our own title here', 'Our own heading', `${words('b', 300)} ${copied} ${words('c', 100)}`)) };
  const r = compare(lse, lcme, config);
  const hit = r.errors.find((e) => e.rule === 'shared-run');
  assert.ok(hit, 'expected a shared-run error');
  assert.match(hit.detail, /12 words shared with \/hire\//);
  assert.match(hit.detail, /our own heading/);
});

test('a 7 to 9 word run only warns', () => {
  const copied = words('a', 400).split(' ').slice(50, 58).join(' ');
  const lse = { '/x/': extractPage(page('Another unique title', 'Another unique heading', `${words('d', 300)} ${copied} ${words('e', 100)}`)) };
  const r = compare(lse, lcme, config);
  assert.equal(r.errors.filter((e) => e.rule === 'shared-run').length, 0);
  assert.ok(r.warnings.some((w) => w.rule === 'shared-run'));
});

test('an exact heading match fails, and a near duplicate fails', () => {
  const lse = {
    '/x/': extractPage(page('Hire a thing', 'How the thing works', words('f', 200))),
    '/y/': extractPage(page('Something else entirely', 'How the thing works now', words('g', 200))),
  };
  const r = compare(lse, lcme, config);
  assert.ok(r.errors.some((e) => e.page === '/x/' && e.rule === 'heading-or-label'));
});

test('a near duplicate heading fails', () => {
  const corpus = { '/a/': toCorpusEntry(extractPage(page('Alpha beta', 'how our thing really works every single day for you', words('r', 200)))) };
  const lse = { '/y/': extractPage(page('Gamma delta', 'how our thing really works every single day for all', words('s', 200))) };
  assert.ok(compare(lse, corpus, config).errors.some((e) => e.rule === 'near-duplicate-heading'));
});

test('banned LCME phrases fail, anywhere on the page', () => {
  const lse = { '/x/': extractPage(page('Fresh title words', 'Fresh heading words', `${words('h', 50)} Ranking is step one.`)) };
  assert.ok(compare(lse, lcme, config).errors.some((e) => e.rule === 'banned-phrase' && /ranking is step one/.test(e.detail)));
});

test('an allowed phrase can be shared, and a long legal run only fails at 30 words', () => {
  const phrase = 'contacting us does not create an attorney client relationship';
  const corpus = { '/a/': toCorpusEntry(extractPage(page('Aaa bbb', 'Ccc ddd', `${words('i', 200)} ${phrase} ${words('j', 200)}`))) };
  const lse = { '/x/': extractPage(page('Eee fff', 'Ggg hhh', `${words('k', 200)} ${phrase} ${words('l', 200)}`)) };
  assert.equal(compare(lse, corpus, config).errors.length, 0);

  const run = words('m', 20);
  const legalCorpus = { '/a/': toCorpusEntry(extractPage(page('Aaa bbb', 'Ccc ddd', `${words('n', 50)} ${run}`))) };
  const legal = { '/privacy-policy/': extractPage(page('Privacy words', 'Policy words', `${words('o', 50)} ${run}`)) };
  assert.equal(compare(legal, legalCorpus, config).errors.length, 0);
  const normal = { '/x/': extractPage(page('Privacy words', 'Policy words', `${words('o', 50)} ${run}`)) };
  assert.ok(compare(normal, legalCorpus, config).errors.length > 0);
});

test('a page over 4 percent shared 6-grams fails', () => {
  // Every 8th position is a copied 6-word piece, with unique words between, so no 10 word run forms.
  const src = words('a', 400).split(' ');
  const parts = [];
  for (let i = 0; i < 20; i++) parts.push(src.slice(i * 12, i * 12 + 6).join(' '), `u${i}a u${i}b u${i}c`);
  const body = `${parts.join(' ')} ${words('p', 120)}`;
  const r = compare({ '/x/': extractPage(page('Plain title', 'Plain heading', body)) }, lcme, config);
  assert.ok(r.errors.some((e) => e.rule === 'shared-6grams'), JSON.stringify(r.pages));
});

test('a clean page passes', () => {
  const lse = { '/x/': extractPage(page('A wholly new title', 'A wholly new heading', words('q', 300))) };
  const r = compare(lse, lcme, config);
  assert.deepEqual(r.errors, []);
});

test('leak scan: LCME IDs, colours and class prefixes fail; the shared Calendly link is allowed', () => {
  const bad = leakScan([
    { name: 'a.html', text: '<div class="cmo-card" style="color:#0066FF">Schibsted Grotesk</div>' },
    { name: 'b.js', text: 'rdt("init","a2_jydlulgcj6dw")' },
    { name: 'c.html', text: '<a href="https://calendly.com/someone/schedule-call">x</a>' },
  ], config);
  const files = new Set(bad.map((h) => h.file));
  assert.ok(files.has('a.html') && files.has('b.js') && files.has('c.html'));
  const ok = leakScan([{ name: 'd.html', text: '<a href="https://calendly.com/connect-with-fahim/schedule-call">Book</a>' }], config);
  assert.deepEqual(ok, []);
});
