import { describe, expect, it } from 'vitest';
import {
  depthBlocks, depthHtml, depthSlotNames, htmlToText, needsNofollow, nofollowLinks, oneParagraph, splitDepth, stackTables, wrapCells,
} from '../../src/lib/markdown';

// Inputs are what Astro's Markdown pipeline writes for the matching Markdown.

describe('stackTables (shared with the posts)', () => {
  it('labels each cell with its column and marks the table', () => {
    const html = stackTables('<table><thead><tr><th>Piece</th><th>Use</th></tr></thead><tbody><tr><td>Table</td><td>Rows</td></tr></tbody></table>');
    expect(html).toBe(
      '<table class="lse-stack" role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Piece</th><th role="columnheader">Use</th></tr></thead>' +
        '<tbody role="rowgroup"><tr role="row"><td role="cell" data-label="Piece">Table</td><td role="cell" data-label="Use">Rows</td></tr></tbody></table>',
    );
  });
});

describe('wrapCells (depth tables only)', () => {
  it('keeps a cell with a link as one item for the phone grid', () => {
    expect(wrapCells('<td role="cell" data-label="Page">See <a href="/seo-pricing/">pricing</a> first</td>')).toBe(
      '<td role="cell" data-label="Page"><span>See <a href="/seo-pricing/">pricing</a> first</span></td>',
    );
  });
});

describe('depthBlocks', () => {
  it('turns [checklist] above a bullet list into a checklist', () => {
    const { html, problems } = depthBlocks('<p>[checklist]</p>\n<ul>\n<li>One</li>\n</ul>');
    expect(html).toBe('<ul class="lse-check">\n<li>One</li>\n</ul>');
    expect(problems).toEqual([]);
  });

  it('turns [steps] above a numbered list into steps, with the bold lead as the title', () => {
    const { html } = depthBlocks('<p>[steps]</p>\n<ol>\n<li><strong>Copy it.</strong> Then more.</li>\n<li>\n<p><strong>Mark it.</strong> Loose.</p>\n</li>\n</ol>');
    expect(html).toBe('<ol class="lse-steps">\n<li><strong class="lse-steps__t">Copy it.</strong> Then more.</li>\n<li>\n<p><strong class="lse-steps__t">Mark it.</strong> Loose.</p>\n</li>\n</ol>');
  });

  it('leaves a plain numbered list alone', () => {
    const input = '<ol>\n<li><strong>One.</strong> Two.</li>\n</ol>';
    expect(depthBlocks(input).html).toBe(input);
  });

  it('turns a quote with a bold lead into a callout', () => {
    const { html, problems } = depthBlocks('<blockquote>\n<p><strong>Nothing is hidden.</strong> Every answer shows.</p>\n</blockquote>');
    expect(html).toBe('<div class="lse-callout" role="note"><p><strong>Nothing is hidden.</strong> Every answer shows.</p></div>');
    expect(problems).toEqual([]);
  });

  it('turns slot and band lines into split points', () => {
    expect(depthBlocks('<p>[slot searches]</p>\n<p>[band mid]</p>').html).toBe('<!--lse:slot:searches-->\n<!--lse:band:mid-->');
  });

  it('marks the highlighter', () => {
    expect(depthBlocks('<p>It has <mark>no preferred word count</mark>.</p>').html).toBe('<p>It has <mark class="lse-mk">no preferred word count</mark>.</p>');
  });

  it('reports every problem a page must not ship', () => {
    const { problems } = depthBlocks(
      [
        '<h3 id="a">Starts at H3</h3>',
        '<h1 id="b">An H1</h1>',
        '<h4 id="c">An H4</h4>',
        '<h2 id="d">A <mark>marked</mark> heading</h2>',
        '<p>[checklist]</p>',
        '<p>[steps]</p>\n<ul><li>not numbered</li></ul>',
        '<p>[slot]</p>',
        '<p>[callout]</p>',
        '<blockquote>\n<p>Builder: Prose + DataTable</p>\n</blockquote>',
        '<blockquote>\n<p>No bold lead here.</p>\n</blockquote>',
        '<p>[ASK FAHIM: how long?] and [NEEDS PRICE OK]</p>',
        '<table><thead><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody></tbody></table>',
      ].join('\n'),
    );
    const all = problems.join('\n');
    expect(all).toMatch(/opens with an H3/);
    expect(all).toMatch(/an H1/);
    expect(all).toMatch(/H4 or smaller/);
    expect(all).toMatch(/<mark> in an H2/);
    expect(all).toMatch(/\[checklist\] must sit right above a bullet list/);
    expect(all).toMatch(/\[steps\] must sit right above a numbered list/);
    expect(all).toMatch(/\[slot\] needs a name/);
    expect(all).toMatch(/unknown marker \[callout\]/);
    expect(all).toMatch(/deck note is still in the copy/);
    expect(all).toMatch(/callout must open with a short bold lead/);
    expect(all).toMatch(/\[ASK FAHIM\] is still in the copy/);
    expect(all).toMatch(/\[NEEDS PRICE OK\] is still in the copy/);
    expect(all).toMatch(/table with 5 columns/);
  });
});

describe('nofollow', () => {
  const domains = ['agency.test'];
  it('matches a listed domain, www and subdomains, and nothing else', () => {
    expect(needsNofollow('https://agency.test/pricing/', domains)).toBe(true);
    expect(needsNofollow('https://www.agency.test/', domains)).toBe(true);
    expect(needsNofollow('https://blog.agency.test/x', domains)).toBe(true);
    expect(needsNofollow('https://notagency.test/', domains)).toBe(false);
    expect(needsNofollow('https://developers.google.com/search/', domains)).toBe(false);
    expect(needsNofollow('/seo-pricing/', domains)).toBe(false);
  });
  it('adds rel="nofollow" to those links only, keeping rel words already there', () => {
    expect(nofollowLinks('<a href="https://agency.test/p?a=1&#x26;b=2">x</a> <a href="https://google.com/">y</a>', domains)).toBe(
      '<a rel="nofollow" href="https://agency.test/p?a=1&#x26;b=2">x</a> <a href="https://google.com/">y</a>',
    );
    expect(nofollowLinks('<a href="https://agency.test/" rel="noopener">x</a>', domains)).toBe('<a href="https://agency.test/" rel="noopener nofollow">x</a>');
  });
  it('uses src/data/nofollow.ts by default (example.com, for the kit sample)', () => {
    expect(depthHtml('<p><a href="https://example.com/">x</a></p>').html).toBe('<p><a rel="nofollow" href="https://example.com/">x</a></p>');
  });
});

describe('text helpers', () => {
  it('keeps the quote marks a <q> draws, and decodes entities', () => {
    expect(htmlToText('Search <q data-no-check>dui lawyer near me</q> &#x26; <a href="/x/">read</a> it&#39;s')).toBe('Search “dui lawyer near me” & read it\'s');
  });
  it('takes exactly one paragraph', () => {
    expect(oneParagraph('<p>One <b>line</b>.</p>')).toBe('One <b>line</b>.');
    expect(oneParagraph('<p>One.</p>\n<p>Two.</p>')).toBeNull();
    expect(oneParagraph('<ul><li>x</li></ul>')).toBeNull();
  });
});

describe('splitDepth', () => {
  const html = [
    '<h2 id="one">One</h2>\n<p>Text.</p>\n<!--lse:slot:searches-->\n<p>More.</p>',
    '<h2 id="two">Two</h2>\n<p>Text.</p>',
    '<!--lse:band:mid-->',
    '<h2 id="three">Three</h2>\n<p>Text.</p>',
    '<!--lse:band:price-->',
  ].join('\n');
  const parts = splitDepth(html);

  it('splits at bands, then at H2s, then at slots', () => {
    expect(parts.map((p) => p.band)).toEqual([undefined, 'mid', 'price']);
    expect(parts[0]?.sections.map((s) => s.id)).toEqual(['one', 'two']);
    expect(parts[0]?.sections[0]?.chunks).toEqual([
      { type: 'html', html: '<h2 id="one">One</h2>\n<p>Text.</p>' },
      { type: 'slot', name: 'searches' },
      { type: 'html', html: '<p>More.</p>' },
    ]);
    expect(parts[1]?.sections.map((s) => s.id)).toEqual(['three']);
    expect(parts[2]?.sections).toEqual([]);
  });

  it('lists the slot and band names the page has to pass', () => {
    expect(depthSlotNames(parts)).toEqual({ slots: ['searches'], bands: ['mid', 'price'] });
  });
});
