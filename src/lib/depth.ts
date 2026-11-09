// A page's depth zone, ready to place: getDepth() reads src/content/depth/<id>.md (rendered and checked by the
// loader in src/content.config.ts), depthSchema() gives the JSON-LD the page passes to InnerPage.
// docs/kit.md "Depth zone" shows the whole page wiring.
import { getEntry } from 'astro:content';
import type { DepthMeta } from '../content.config';
import type { FaqItem } from '../components/Faq.astro';
import { fahimSchema, site } from '../data/site';
import { webPageSchema } from './schema';

export interface DepthHeading {
  id: string;
  text: string;
}
export interface DepthSource {
  url: string;
  title?: string;
  publisher?: string;
  /** host and path, for a source given as a bare URL. */
  label: string;
}
export interface Depth {
  id: string;
  /** The body: sections with their H2s, marker comments for slots and bands. */
  html: string;
  /** The body's H2s, in order: the jump list. */
  headings: DepthHeading[];
  /** The summary paragraph's inner HTML. */
  summaryHtml: string;
  reviewed: Date;
  modified: Date;
  faqHeading: string;
  /** The FAQ, also what InnerPage's `faq` prop needs for FAQPage JSON-LD. */
  faq: FaqItem[];
  /** 'open': every answer shown. 'accordion': each question a closed <details>. */
  faqStyle: 'open' | 'accordion';
  /** The author box line's inner HTML. */
  authorHtml: string;
  sources: DepthSource[];
}

const sourceLabel = (u: string) => {
  const x = new URL(u);
  return `${x.hostname.replace(/^www\./, '')}${x.pathname === '/' ? '' : x.pathname.replace(/\/$/, '')}`;
};

/** The depth zone for src/content/depth/<id>.md. A missing file fails the build. */
export async function getDepth(id: string): Promise<Depth> {
  const entry = await getEntry('depth', id);
  if (!entry) throw new Error(`No depth copy "${id}": add src/content/depth/${id}.md`);
  const meta = entry.rendered?.metadata?.depth as DepthMeta | undefined;
  if (!entry.rendered || !meta) throw new Error(`src/content/depth/${id}.md wasn't rendered by the depth loader`);
  const d = entry.data;
  const headings = (entry.rendered.metadata?.headings ?? []) as { depth: number; slug: string; text: string }[];
  return {
    id,
    html: entry.rendered.html,
    headings: headings.filter((h) => h.depth === 2).map((h) => ({ id: h.slug, text: h.text })),
    summaryHtml: meta.summaryHtml,
    reviewed: d.reviewed,
    modified: d.modified ?? d.reviewed,
    faqHeading: d.faqHeading ?? '',
    faq: meta.faq,
    faqStyle: d.faqStyle,
    authorHtml: meta.authorHtml,
    sources: d.sources.map((s) => (typeof s === 'string' ? { url: s, label: sourceLabel(s) } : { ...s, label: sourceLabel(s.url) })),
  };
}

/** The JSON-LD a page with a depth zone adds through InnerPage's `schema` prop: Fahim's Person node and the WebPage
 *  node that names him author and reviewer, with the review dates. Neither Base nor InnerPage emits a Person, so
 *  this is the page's only one. On a page that already passes fahimSchema, use webPageSchema() alone. */
export function depthSchema(depth: Depth, page: { path: string; title: string; description?: string }): object[] {
  const url = new URL(page.path, site.url).href;
  return [
    fahimSchema,
    webPageSchema({ name: page.title, description: page.description, reviewed: depth.reviewed, modified: depth.modified }, url, site.url),
  ];
}
