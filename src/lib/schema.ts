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
