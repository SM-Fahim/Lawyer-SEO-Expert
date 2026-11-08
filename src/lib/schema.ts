import { fahimSchema } from '../data/site';
import { isoDay } from './dates';

/** A visible FAQ item: the same shape as Faq.astro's FaqItem (kept here so this file imports no component). */
export interface FaqEntry {
  q: string;
  html: string;
  text?: string;
}

const plain = (html: string) =>
  html
    .replace(/<span class="lse-ph"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** FAQPage JSON-LD from the visible FAQ items. Placeholders are left out of the answers. */
export function faqSchema(items: readonly FaqEntry[], pageUrl: string): object {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.text ?? plain(item.html) },
    })),
  };
}

export interface Crumb {
  label: string;
  /** Path with trailing slash. The last crumb (the page itself) may leave it out. */
  href?: string;
}

/** BreadcrumbList JSON-LD. `trail` starts after Home; the last item is the page itself (its href defaults to pageUrl). */
export function breadcrumbSchema(trail: readonly Crumb[], pageUrl: string, siteUrl: string): object {
  const items = [{ label: 'Home', href: '/' }, ...trail];
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: i === items.length - 1 && !c.href ? pageUrl : new URL(c.href ?? '/', siteUrl).href,
    })),
  };
}

export interface ServiceInput {
  /** "SEO for personal injury lawyers". */
  name: string;
  description?: string;
  /** Defaults to "Search engine optimization". */
  serviceType?: string;
  /** 'monthly': from $2,000 a month (SEO). 'once': from $2,000 (a website build). false: no offer. */
  offer?: 'monthly' | 'once' | false;
}

/** Service JSON-LD with the one approved price as a "from" offer. No ratings or reviews, ever. */
export function serviceSchema(input: ServiceInput, pageUrl: string, orgId: string): object {
  const { name, description, serviceType = 'Search engine optimization', offer = 'monthly' } = input;
  const offers =
    offer === 'monthly'
      ? {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: 2000,
          description: 'From $2,000 a month',
          priceSpecification: { '@type': 'UnitPriceSpecification', minPrice: 2000, priceCurrency: 'USD', unitText: 'MONTH', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } },
        }
      : offer === 'once'
        ? { '@type': 'Offer', priceCurrency: 'USD', price: 2000, description: 'From $2,000', priceSpecification: { '@type': 'PriceSpecification', minPrice: 2000, priceCurrency: 'USD' } }
        : undefined;
  return {
    '@type': 'Service',
    '@id': `${pageUrl}#service`,
    name,
    ...(description ? { description } : {}),
    serviceType,
    url: pageUrl,
    provider: { '@id': orgId },
    areaServed: { '@type': 'Country', name: 'United States' },
    ...(offers ? { offers } : {}),
  };
}

export interface WebPageInput {
  /** The page's title. */
  name: string;
  description?: string;
  /** The day the page's copy was last checked. */
  reviewed: Date | string;
  /** The day the copy last changed. Defaults to the review day. */
  modified?: Date | string;
  /** The author and reviewer's Person @id. Defaults to S. M. Fahim's, the node fahimSchema emits. */
  personId?: string;
}

/** WebPage JSON-LD for a page with a depth zone: S. M. Fahim as author and reviewer, the review and change dates
 *  as ISO days. It points at the Person by @id only, so the page passes fahimSchema beside it (Base and InnerPage
 *  don't emit a Person). It also points at the page's BreadcrumbList (InnerPage) and the site's WebSite node. */
export function webPageSchema(input: WebPageInput, pageUrl: string, siteUrl: string): object {
  const { name, description, reviewed, modified = reviewed, personId = fahimSchema['@id'] } = input;
  return {
    '@type': 'WebPage',
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name,
    ...(description ? { description } : {}),
    isPartOf: { '@id': `${siteUrl}/#site` },
    breadcrumb: { '@id': `${pageUrl}#breadcrumb` },
    inLanguage: 'en-US',
    author: { '@id': personId },
    reviewedBy: { '@id': personId },
    lastReviewed: isoDay(reviewed),
    dateModified: isoDay(modified),
  };
}
