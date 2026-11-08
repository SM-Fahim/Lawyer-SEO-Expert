import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { calculatorHtml } from './components/blog/calculator-markup';
import { depthHtml, htmlToText, oneParagraph, stackTables } from './lib/markdown';

// The nine posts, from ../content/posts/ with the light v2 edits (docs/DECISIONS.md). Each is served at its
// old root URL (/law-firm-names/), by src/pages/[slug].astro. The calculator post has a "{{calculator}}" line,
// which becomes the real calculator before the Markdown is rendered.
const CALC_MARKER = /^\{\{calculator\}\}\s*$/m;
const NAMES_SLUG = 'law-firm-names';

/** law-firm-names: a list made only of short plain items (names, not sentences) gets class="lse-names", which
 *  prose.css sets as a skimmable grid of rows. Lists of sentences, links or bold leads stay bullet lists. */
function markNameLists(html: string): string {
  return html.replace(/<ul>([\s\S]*?)<\/ul>/g, (whole, inner: string) => {
    const items = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => (m[1] ?? '').trim());
    const short = (t: string) => !t.includes('<') && !/\.$/.test(t.replace(/Co\.$/, '')) && t.split(/\s+/).length <= 7;
    return items.length >= 4 && items.every(short) ? `<ul class="lse-names">${inner}</ul>` : whole;
  });
}

function postsLoader() {
  const base = glob({ pattern: '*.md', base: './src/content/posts' });
  return {
    name: 'lse-posts',
    async load(ctx: Parameters<typeof base.load>[0]) {
      await base.load(ctx);
      for (const entry of ctx.store.values()) {
        const calc = !!entry.body && CALC_MARKER.test(entry.body);
        const names = entry.id === NAMES_SLUG;
        const tables = !!entry.body && /^\|.*\|\s*$/m.test(entry.body);
        if (!entry.body || (!calc && !names && !tables)) continue;
        const body = calc ? entry.body.replace(CALC_MARKER, `${calculatorHtml()}\n`) : entry.body;
        const rendered = await ctx.renderMarkdown(body, entry.filePath ? { fileURL: new URL(entry.filePath, ctx.config.root) } : undefined);
        if (names) rendered.html = markNameLists(rendered.html);
        if (tables) rendered.html = stackTables(rendered.html);
        ctx.store.set({ ...entry, body, rendered, digest: ctx.generateDigest(`${body}|names-v1|stack-v1`) });
      }
    },
  };
}

const posts = defineCollection({
  loader: postsLoader(),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    h1: z.string(),
    slug: z.string(),
    author: z.string(),
    category: z.string(),
    published: z.coerce.date(),
    updated: z.coerce.date(),
    /** The line above the closing booking button: what Fahim does in the call, for this post's reader. */
    cta: z.string(),
    sources: z.array(z.url()).default([]),
  }),
});

// ---------- Depth zones ----------
// The long, in-depth part of a service or practice page, under its commercial top (content/DEPTH-BRIEF.md
// section 2.2). One file per page, src/content/depth/<page slug>.md: the front matter holds the summary, the
// open FAQ, the review date, the author box line and the sources; the body is the sections. It goes through the
// posts' Markdown pipeline, then src/lib/markdown.ts (checklists, steps, callouts, slots, stacked tables,
// nofollow). docs/kit.md "Depth zone" has the syntax. Any problem in the copy fails the build.
const DEPTH_PASS = 'depth-v2';

const depthSource = z.union([
  z.url(),
  // The deck's own source entries paste in as they are; id, checked and supports are dropped here.
  z.object({ url: z.url(), title: z.string().optional(), publisher: z.string().optional() }),
]);

const depthSchema = z.object({
  /** 100 to 150 words, one paragraph, no heading. Inline Markdown (links, bold, <dfn>, <q data-no-check>). */
  summary: z.string(),
  /** "Last reviewed" in the byline, and WebPage lastReviewed. */
  reviewed: z.coerce.date(),
  /** WebPage dateModified. Defaults to the review day. */
  modified: z.coerce.date().optional(),
  /** The FAQ's H2. Needed when there are questions. */
  faqHeading: z.string().optional(),
  /** Every answer is shown open, and FAQPage JSON-LD is built from the same items. One paragraph each. */
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  /** The author box's one or two lines, from FACTS, in this page's own words. Inline Markdown. */
  authorLine: z.string(),
  sources: z.array(depthSource).default([]),
});
export type DepthData = z.infer<typeof depthSchema>;

/** Rendered extras the loader keeps in rendered.metadata.depth (read by src/lib/depth.ts). */
export interface DepthMeta {
  summaryHtml: string;
  authorHtml: string;
  faq: { q: string; html: string; text: string }[];
}

function depthLoader() {
  const base = glob({ pattern: '*.md', base: './src/content/depth' });
  return {
    name: 'lse-depth',
    async load(ctx: Parameters<typeof base.load>[0]) {
      await base.load(ctx);
      for (const entry of ctx.store.values()) {
        const file = entry.filePath ?? `src/content/depth/${entry.id}.md`;
        const data = entry.data as DepthData;
        const problems: string[] = [];
        const inline = async (markdown: string, what: string) => {
          const one = oneParagraph((await ctx.renderMarkdown(markdown)).html);
          if (one === null) problems.push(`${what} must be one paragraph`);
          const out = depthHtml(one ?? '');
          problems.push(...out.problems.map((p) => `${what}: ${p}`));
          return out.html;
        };

        const body = await ctx.renderMarkdown(entry.body ?? '', entry.filePath ? { fileURL: new URL(entry.filePath, ctx.config.root) } : undefined);
        const zone = depthHtml(body.html);
        problems.push(...zone.problems);
        const summaryHtml = await inline(data.summary, 'summary');
        const authorHtml = await inline(data.authorLine, 'authorLine');
        const faq: DepthMeta['faq'] = [];
        for (const [i, item] of data.faq.entries()) {
          const q = htmlToText(await inline(item.q, `faq ${i + 1} question`));
          const html = await inline(item.a, `faq ${i + 1} answer ("${item.q.slice(0, 40)}")`);
          faq.push({ q, html, text: htmlToText(html) });
        }
        if (faq.length && !data.faqHeading) problems.push('faqHeading is missing (the FAQ needs its H2)');
        if (problems.length) throw new Error(`${file}: the depth copy has ${problems.length} problem(s):\n  ${problems.join('\n  ')}`);

        const depth: DepthMeta = { summaryHtml, authorHtml, faq };
        ctx.store.set({
          ...entry,
          rendered: { html: zone.html, metadata: { ...body.metadata, depth } },
          digest: ctx.generateDigest(`${entry.body ?? ''}|${JSON.stringify(entry.data)}|${DEPTH_PASS}`),
        });
      }
    },
  };
}

const depth = defineCollection({ loader: depthLoader(), schema: depthSchema });

export const collections = { posts, depth };
