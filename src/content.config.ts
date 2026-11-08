import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { calculatorHtml } from './components/blog/calculator-markup';

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
        if (!entry.body || (!calc && !names)) continue;
        const body = calc ? entry.body.replace(CALC_MARKER, `${calculatorHtml()}\n`) : entry.body;
        const rendered = await ctx.renderMarkdown(body, entry.filePath ? { fileURL: new URL(entry.filePath, ctx.config.root) } : undefined);
        if (names) rendered.html = markNameLists(rendered.html);
        ctx.store.set({ ...entry, body, rendered, digest: ctx.generateDigest(`${body}|names-v1`) });
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

export const collections = { posts };
