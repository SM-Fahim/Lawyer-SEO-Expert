// Each page's type, sent to Meta as ViewContent's content_category so retargeting audiences pick up
// new pages by rule instead of a URL list. Base.astro requires one, and the layouts set the default:
// InnerPage gives "service", blog posts and listings give "blog", proposals give "company".
// scripts/check-dist.mjs keeps its own copy of this list (a test checks they match).
export const PAGE_TYPES = ['service', 'pricing', 'booking', 'blog', 'company'] as const;

export type PageType = (typeof PAGE_TYPES)[number];

/** The value if it's one of the five, else undefined. */
export const pageTypeOf = (value: unknown): PageType | undefined =>
  typeof value === 'string' && (PAGE_TYPES as readonly string[]).includes(value) ? (value as PageType) : undefined;
