// Passes over the HTML that Astro's Markdown pipeline makes. The posts (src/content.config.ts) and the depth zone
// (src/content/depth/, docs/kit.md "Depth zone") share them, so both read and stack the same way.
// Plain string work on Astro's own well-formed output: no parser, no extra dependency.
import { nofollowDomains } from '../data/nofollow';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes the entities Astro's HTML output uses (&#x26;, &amp;, &#39; ...). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? whole;
    return String.fromCodePoint(code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
  });
}

/** Plain text from a bit of rendered HTML, for JSON-LD. A <q> keeps its quote marks, which CSS draws on the page. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<q\b[^>]*>/gi, '“')
      .replace(/<\/q>/gi, '”')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tables, readable on a phone (QA M4): each body cell gets its column's heading as data-label and the table gets
 *  class="lse-stack", so prose.css sets each row as a block of "label  value" lines under 640px instead of
 *  cutting columns off. Explicit ARIA roles keep it a table for screen readers once CSS changes its display. */
export function stackTables(html: string): string {
  const strip = (t: string) => t.replace(/<[^>]+>/g, '').trim();
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (whole, inner: string) => {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(inner)?.[1];
    if (!head) return whole;
    const names = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => strip(m[1] ?? '').replace(/"/g, '&quot;'));
    const body = inner
      .replace(/<thead>/, '<thead role="rowgroup">')
      .replace(/<tbody>/, '<tbody role="rowgroup">')
      .replace(/<tr>/g, '<tr role="row">')
      .replace(/<th(?=[\s>])/g, '<th role="columnheader"')
      .replace(/<tr role="row">([\s\S]*?)<\/tr>/g, (_row: string, cells: string) => {
        let i = 0;
        const out = cells.replace(/<td(?=[\s>])/g, () => `<td role="cell" data-label="${names[i++] ?? ''}"`);
        return `<tr role="row">${out}</tr>`;
      });
    return `<table class="lse-stack" role="table">${body}</table>`;
  });
}

// ---------- Nofollow ----------

/** True for an http(s) link to one of the domains in src/data/nofollow.ts, or a subdomain of one. */
export function needsNofollow(href: string, domains: readonly string[] = nofollowDomains): boolean {
  if (!/^https?:\/\//i.test(href)) return false;
  let host: string;
  try {
    host = new URL(href).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Adds rel="nofollow" to every link that needs it (keeping any rel words already there). */
export function nofollowLinks(html: string, domains: readonly string[] = nofollowDomains): string {
  return html.replace(/<a\s[^>]*>/gi, (tag) => {
    const href = /\shref="([^"]*)"/i.exec(tag)?.[1];
    if (!href || !needsNofollow(decodeEntities(href), domains)) return tag;
    const rel = /\srel="([^"]*)"/i.exec(tag);
    if (!rel) return tag.replace(/^<a/i, '<a rel="nofollow"');
    const words = new Set((rel[1] ?? '').split(/\s+/).filter(Boolean));
    words.add('nofollow');
    return tag.replace(rel[0], ` rel="${[...words].join(' ')}"`);
  });
}

// ---------- The depth zone's blocks ----------
// Writers write plain Markdown. Builders add at most these marker lines, each alone on its own line:
//   [checklist]    right above a bullet list: rows with a check mark
//   [steps]        right above a numbered list: big numerals; a bold lead on an item becomes its title
//   [slot name]    a kit piece the page passes with slot="name" (SearchBox, Shot, Rows ...), in the text column
//   [band name]    a full-width section the page passes with slot="name" (the mid-page CTA, a PriceBand)
// A Markdown quote ("> **Lead.** text") is a Callout. <mark> is the highlighter (.lse-mk).

const MARKER = /<p>\[([a-z]+)(?:\s+([a-z0-9-]+))?\]<\/p>/g;
const LEFT_IN = [
  [/\[ASK FAHIM/i, '[ASK FAHIM]'],
  [/NEEDS PRICE OK/i, '[NEEDS PRICE OK]'],
  [/\[ZVQ\]/i, '[ZVQ]'],
] as const;

export interface DepthBlocks {
  html: string;
  /** What's wrong with the copy. The loader fails the build on any of these. */
  problems: string[];
}

/** The depth zone's blocks and checks, on Astro's rendered HTML. Run it before stackTables. */
export function depthBlocks(input: string): DepthBlocks {
  const problems: string[] = [];
  let html = input;

  // Checklist and steps: the marker paragraph goes, its list gets the class.
  html = html.replace(/<p>\[checklist\]<\/p>\s*<ul>/g, '<ul class="lse-check">');
  html = html.replace(/<p>\[steps\]<\/p>\s*<ol(\s[^>]*)?>/g, (_m, attrs: string | undefined) => `<ol class="lse-steps"${attrs ?? ''}>`);
  // A step that starts with a bold lead: the lead is the step's title.
  html = html.replace(/<ol class="lse-steps"[^>]*>[\s\S]*?<\/ol>/g, (list) =>
    list.replace(/<li>(\s*<p>)?\s*<strong>/g, (_m, p: string | undefined) => `<li>${p ?? ''}<strong class="lse-steps__t">`),
  );

  // Slots and bands become comments the DepthZone component splits on. Anything else in brackets is a typo.
  html = html.replace(MARKER, (whole, kind: string, name: string | undefined) => {
    if ((kind === 'slot' || kind === 'band') && name) return `<!--lse:${kind}:${name}-->`;
    const line = whole.replace(/<\/?p>/g, '');
    if (kind === 'checklist') problems.push(`${line} must sit right above a bullet list`);
    else if (kind === 'steps') problems.push(`${line} must sit right above a numbered list (starting at 1)`);
    else if (kind === 'slot' || kind === 'band') problems.push(`${line} needs a name, like [${kind} mid]`);
    else problems.push(`unknown marker ${line} (the markers are [checklist], [steps], [slot name] and [band name])`);
    return whole;
  });

  // Callouts: a Markdown quote that opens with a bold lead. A deck's "> Builder:" or "> Judge:" note is not copy.
  html = html.replace(/<blockquote>\s*([\s\S]*?)\s*<\/blockquote>/g, (_m, inner: string) => {
    const text = htmlToText(inner);
    if (/^(builder|judge|note|todo)\s*:/i.test(text)) problems.push(`a deck note is still in the copy: "${text.slice(0, 60)}"`);
    else if (!/^<p><strong>/.test(inner)) problems.push(`a callout must open with a short bold lead ("> **Lead.** text"): "${text.slice(0, 60)}"`);
    return `<div class="lse-callout" role="note">${inner}</div>`;
  });

  // The highlighter: one fact per block, never in a heading (docs/design-system.md, the marks).
  html = html.replace(/<mark>/g, '<mark class="lse-mk">');
  for (const [, level, inner] of html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)) {
    if (inner?.includes('<mark')) problems.push(`<mark> in an H${level}: the highlighter never goes in a heading`);
  }

  for (const [re, what] of LEFT_IN) if (re.test(html)) problems.push(`${what} is still in the copy`);

  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
  if (levels.includes(1)) problems.push('an H1 (#) in the depth copy: the hero has the page\'s only H1, so sections start at ##');
  if (levels.some((l) => l >= 4)) problems.push('an H4 or smaller: the depth zone uses ## and ### only');
  if (levels[0] === 3) problems.push('the copy opens with an H3 (###): open each section with an H2 (##)');

  for (const [table] of html.matchAll(/<table>[\s\S]*?<\/table>/g)) {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table)?.[1] ?? '';
    const cols = (head.match(/<th[\s>]/g) ?? []).length;
    if (cols > 4) problems.push(`a table with ${cols} columns: the most is 4 (split it in two, or use rows)`);
  }

  return { html, problems };
}

/** Each stacked cell's content in one <span>. On a phone prose.css sets a cell as a grid of its label and its
 *  content, and without the span a cell like "See [pricing](/seo-pricing/) first" would split into three grid
 *  items. Depth tables have links in cells; the posts' tables don't, so the posts keep their markup. */
export function wrapCells(html: string): string {
  return html.replace(/(<td role="cell"[^>]*>)([\s\S]*?)(<\/td>)/g, '$1<span>$2</span>$3');
}

/** The whole depth pass: blocks, phone-stacked tables, nofollow. */
export function depthHtml(input: string): DepthBlocks {
  const { html, problems } = depthBlocks(input);
  return { html: nofollowLinks(wrapCells(stackTables(html))), problems };
}

/** One paragraph of rendered Markdown without its <p>, for a summary line, a question or an answer. Null when the
 *  Markdown made anything but exactly one paragraph. */
export function oneParagraph(html: string): string | null {
  const m = /^\s*<p>([\s\S]*)<\/p>\s*$/.exec(html);
  if (!m || /<\/p>|<p[\s>]/.test(m[1] ?? '')) return null;
  return (m[1] ?? '').trim();
}

// ---------- Splitting the zone for the page ----------

export type DepthChunk = { type: 'html'; html: string } | { type: 'slot'; name: string };
export interface DepthSection {
  /** The id of the H2 the section opens with. */
  id?: string;
  chunks: DepthChunk[];
}
export interface DepthPart {
  /** The full-width slot ([band name]) that comes before this part. */
  band?: string;
  sections: DepthSection[];
}

const BAND_SPLIT = /<!--lse:band:([a-z0-9-]+)-->/;
const SLOT_SPLIT = /<!--lse:slot:([a-z0-9-]+)-->/;

function sectionsOf(html: string): DepthSection[] {
  return html
    .split(/(?=<h2[\s>])/)
    .filter((s) => s.trim())
    .map((s) => {
      const id = /^<h2[^>]*\sid="([^"]+)"/.exec(s)?.[1];
      const chunks: DepthChunk[] = [];
      s.split(SLOT_SPLIT).forEach((bit, i) => {
        if (i % 2) chunks.push({ type: 'slot', name: bit });
        else if (bit.trim()) chunks.push({ type: 'html', html: bit.trim() });
      });
      return id ? { id, chunks } : { chunks };
    });
}

/** Splits the zone's HTML into parts (at each [band]), parts into H2 sections, sections into text and [slot]s. */
export function splitDepth(html: string): DepthPart[] {
  const pieces = html.split(BAND_SPLIT);
  const parts: DepthPart[] = [];
  for (let i = 0; i < pieces.length; i += 2) {
    const band = i > 0 ? pieces[i - 1] : undefined;
    const sections = sectionsOf(pieces[i] ?? '');
    parts.push(band ? { band, sections } : { sections });
  }
  return parts;
}

/** Every slot and band name the zone uses, in order. */
export function depthSlotNames(parts: readonly DepthPart[]): { slots: string[]; bands: string[] } {
  const bands = parts.flatMap((p) => (p.band ? [p.band] : []));
  const slots = parts.flatMap((p) => p.sections.flatMap((s) => s.chunks.flatMap((c) => (c.type === 'slot' ? [c.name] : []))));
  return { slots: [...new Set(slots)], bands: [...new Set(bands)] };
}
