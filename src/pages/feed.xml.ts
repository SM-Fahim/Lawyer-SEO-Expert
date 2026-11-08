// RSS feed. The Worker serves dist/feed.xml at /feed/ (worker/router.ts).
import type { APIRoute } from 'astro';
import { allPosts } from '../lib/posts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async () => {
  const posts = await allPosts();
  const base = 'https://lawyerseoexpert.com';
  const items = posts
    .map((p) => {
      const url = `${base}/${p.data.slug}/`;
      return `<item><title>${esc(p.data.h1)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${p.data.published.toUTCString()}</pubDate><category>${esc(p.data.category)}</category><description>${esc(p.data.description)}</description></item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Lawyer SEO Expert</title><link>${base}/blog/</link><description>Guides on law firm SEO, websites and intake, by S. M. Fahim.</description><language>en-US</language><atom:link href="${base}/feed/" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
