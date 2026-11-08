import type { FaqItem } from '../components/Faq.astro';

const plain = (html: string) =>
  html
    .replace(/<span class="lse-ph"[^>]*>[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** FAQPage JSON-LD from the visible FAQ items. Placeholders are left out of the answers. */
export function faqSchema(items: readonly FaqItem[], pageUrl: string): object {
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
