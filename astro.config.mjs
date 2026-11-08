import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// The sitemap runs after the pages are written, so it can read each page's own robots tag. A noindex or draft
// page can't get in by being left off a list. scripts/check-dist.mjs checks the result on every build.
function isIndexable(pageUrl) {
  const file = new URL(`./dist${new URL(pageUrl).pathname}index.html`, import.meta.url);
  if (!existsSync(file)) return false;
  const html = readFileSync(file, 'utf8');
  return !/<meta name="robots" content="[^"]*noindex/i.test(html) && !html.includes('data-draft');
}

// The integration copies the newest page's date onto the index, as if the sitemap file last changed then. It
// changes with every page, so that would be false. No date is better than a wrong one.
const plainSitemapIndex = {
  name: 'plain-sitemap-index',
  hooks: {
    'astro:build:done': ({ dir }) => {
      const file = new URL('sitemap-index.xml', dir);
      writeFileSync(file, readFileSync(file, 'utf8').replace(/<lastmod>[^<]*<\/lastmod>/g, ''));
    },
  },
};

export default defineConfig({
  site: 'https://lawyerseoexpert.com',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  integrations: [sitemap({ filter: isIndexable }), plainSitemapIndex],
  // TODO(blog): if LSE ships a blog, add its markdown settings here (LCME's turned off smart punctuation and GFM).
});
