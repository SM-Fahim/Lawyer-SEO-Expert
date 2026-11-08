import { describe, expect, it } from 'vitest';
import { fahimSchema } from '../../src/data/site';
import { dayMonthYear, isoDay } from '../../src/lib/dates';
import { faqSchema, webPageSchema } from '../../src/lib/schema';

const pageUrl = 'https://lawyerseoexpert.com/seo-for-dui-attorneys/';
const siteUrl = 'https://lawyerseoexpert.com';

describe('webPageSchema', () => {
  const node = webPageSchema(
    { name: 'SEO for DUI Attorneys', description: 'A description.', reviewed: new Date('2026-11-08T00:00:00Z') },
    pageUrl,
    siteUrl,
  ) as Record<string, unknown>;

  it('is a WebPage with its own @id and url', () => {
    expect(node['@type']).toBe('WebPage');
    expect(node['@id']).toBe(`${pageUrl}#webpage`);
    expect(node.url).toBe(pageUrl);
    expect(node.name).toBe('SEO for DUI Attorneys');
    expect(node.description).toBe('A description.');
  });

  it('names Fahim as author and reviewer by the @id fahimSchema emits', () => {
    expect(fahimSchema['@id']).toBe('https://lawyerseoexpert.com/#fahim');
    expect(node.author).toEqual({ '@id': fahimSchema['@id'] });
    expect(node.reviewedBy).toEqual({ '@id': fahimSchema['@id'] });
  });

  it('gives lastReviewed and dateModified as ISO days, modified defaulting to reviewed', () => {
    expect(node.lastReviewed).toBe('2026-11-08');
    expect(node.dateModified).toBe('2026-11-08');
    const later = webPageSchema({ name: 'x', reviewed: '2026-11-08', modified: '2026-12-01' }, pageUrl, siteUrl) as Record<string, unknown>;
    expect(later.lastReviewed).toBe('2026-11-08');
    expect(later.dateModified).toBe('2026-12-01');
  });

  it('links the breadcrumb and the site, and carries no Person node of its own', () => {
    expect(node.breadcrumb).toEqual({ '@id': `${pageUrl}#breadcrumb` });
    expect(node.isPartOf).toEqual({ '@id': 'https://lawyerseoexpert.com/#site' });
    expect(JSON.stringify(node)).not.toContain('"Person"');
  });

  it('leaves out an empty description', () => {
    const bare = webPageSchema({ name: 'x', reviewed: '2026-11-08' }, pageUrl, siteUrl) as Record<string, unknown>;
    expect('description' in bare).toBe(false);
  });

  it('fails on a date that is not a calendar day', () => {
    expect(() => webPageSchema({ name: 'x', reviewed: '8 November 2026' }, pageUrl, siteUrl)).toThrow();
  });
});

describe('dates', () => {
  it('formats day, month, year in UTC', () => {
    expect(isoDay(new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-08');
    expect(dayMonthYear('2026-11-08')).toBe('8 November 2026');
  });
});

describe('faqSchema', () => {
  it('uses the plain answer when given', () => {
    const faq = faqSchema([{ q: 'Why?', html: 'Because <a href="/x/">this</a>.', text: 'Because this.' }], pageUrl) as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq.mainEntity[0]?.name).toBe('Why?');
    expect(faq.mainEntity[0]?.acceptedAnswer.text).toBe('Because this.');
  });
});
