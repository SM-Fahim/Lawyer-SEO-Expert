import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

const fmt = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const longDate = (d: Date) => fmt.format(d);
export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** The calculator post: the blog index shows it on its own, and it loads the calculator script. */
export const CALCULATOR_SLUG = 'pi-settlement-and-attorney-fee-calculator';

/** Reading time in whole minutes at 220 words a minute, from the Markdown with tags and link targets removed. */
export function readingMinutes(post: Post): number {
  const text = (post.body ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/[#*|>_`-]/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** Newest first by published date, then by title. */
export async function allPosts(): Promise<Post[]> {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.data.title.localeCompare(b.data.title));
}

/** "Title | Lawyer SEO Expert" when it fits in 60 characters, else the title alone. */
export function pageTitle(title: string): string {
  const full = `${title} | Lawyer SEO Expert`;
  return full.length <= 60 ? full : title;
}
