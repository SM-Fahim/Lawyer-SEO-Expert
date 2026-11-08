// Phone crops for the money pages (/law-firm-seo-services/, /seo-pricing/, /law-firm-seo-consultant/).
// A wide Google capture squeezed into a 358px phone column sets its text at 4 to 8px: too small to read. These
// are plain rectangle crops of the entries in proof.ts (same pixels, nothing edited), cut to the part that
// proves the claim, so the text reads at 10px and up on a phone. money/ShotSwap.astro shows them under 760px
// and the full capture above it. Kept in their own file so the parallel builders never edit the same lines of
// proof.ts. Marks: % of each crop, measured from its pixels.
import type { Proof } from './proof';

const P = '/img/proof/';

export const phoneProof = {
  /** nola-calls-jun-oct-2026.webp, the totals only: 139 calls and +39.0% (the chart's labels are 5px on a phone). */
  nolaCallsTotal: {
    src: `${P}nola-calls-total-phone.webp`,
    width: 520,
    height: 130,
    alt: 'Google Business Profile: 139 calls from June to October 2026, up 39% on the same months of 2025',
    caption: '139 calls, up 39%.',
    source: 'public/img/proof/nola-calls-jun-oct-2026.webp, x 24 to 544, y 180 to 310',
    marks: { total: [{ l: 2.5, t: 11, w: 15.5, h: 36 }], growth: [{ l: 7.3, t: 72, w: 14.5, h: 15 }] },
  },
  /** nola-jackknife.webp, x 0 to 400 (left of the open source popup). Use the two crops as two parts. */
  jackknifeLeft: {
    src: `${P}nola-jackknife-left-phone.webp`,
    width: 400,
    height: 625,
    alt: 'Google search for jackknife truck accident Louisiana: a New Orleans PI firm’s page is the first result, 7 days after going live',
    caption: 'jackknife truck accident Louisiana',
    source: 'public/img/proof/nola-jackknife.webp, x 0 to 400',
    marks: { result: [{ l: 5.5, t: 88.3, w: 94, h: 4.3 }] },
    crops: { search: { top: 0, height: 9.6 }, result: { top: 80.5, height: 19.5 } },
  },
  wtdQuery: {
    src: `${P}nola-wtd-query-phone.webp`,
    width: 560,
    height: 67,
    alt: '',
    caption: 'what to do after a truck accident in New Orleans',
    source: 'public/img/proof/nola-wtd-query.webp, x 0 to 560',
  },
  wtdRank: {
    src: `${P}nola-wtd-rank-phone.webp`,
    width: 560,
    height: 162,
    alt: 'A New Orleans PI firm’s page, What to Do After a Truck Accident, as the first result on Google',
    caption: '#1 for what to do after a truck accident in New Orleans.',
    source: 'public/img/proof/nola-wtd-rank.webp, x 0 to 560',
    marks: { title: [{ l: 3.6, t: 40.7, w: 77.7, h: 18.5 }] },
  },
  wtdAiLeft: {
    src: `${P}nola-wtd-ai-left-phone.webp`,
    width: 690,
    height: 776,
    alt: 'Google’s AI answer for what to do after a truck accident in New Orleans, citing a New Orleans PI firm three times',
    caption: 'Quoted 3 times in Google’s AI answer.',
    source: 'public/img/proof/nola-wtd-ai.webp, x 0 to 690',
    marks: { citations: [{ l: 78.3, t: 25.8, w: 18.8, h: 3.2 }, { l: 18.4, t: 48.9, w: 15.4, h: 3.3 }, { l: 80.1, t: 63.3, w: 15.5, h: 3.1 }] },
  },
  tankerFirm: {
    src: `${P}nola-tanker-ai-firm-phone.webp`,
    width: 540,
    height: 166,
    alt: 'Google’s AI lists a New Orleans PI firm under key legal firms handling tanker accidents, rated 5.0 from 317 reviews',
    caption: 'Key legal firms for tanker accidents in New Orleans.',
    source: 'public/img/proof/nola-tanker-ai.webp, x 0 to 540, y 134 to 300 (blank space above the heading, so the tag covers no text)',
    marks: { name: [{ l: 22.6, t: 44.6, w: 13.7, h: 11.5 }], rating: [{ l: 22.6, t: 60.2, w: 23.7, h: 9.6 }] },
  },
  elpasoQuery: {
    src: `${P}elpaso-ai-query-phone.webp`,
    width: 470,
    height: 66,
    alt: '',
    caption: 'Texas El Paso car accident filing deadline',
    source: 'public/img/proof/elpaso-ai-deadline.webp, x 15 to 485, y 8 to 74',
  },
  elpasoSource: {
    src: `${P}elpaso-ai-source-phone.webp`,
    width: 470,
    height: 176,
    alt: 'The first source card in Google’s AI answer: an El Paso PI firm’s page on the Texas car accident filing deadline',
    caption: 'The first source Google’s AI answer cites.',
    source: 'public/img/proof/elpaso-ai-deadline.webp, x 928 to 1398, y 236 to 412',
    marks: { title: [{ l: 4.7, t: 34.7, w: 62.8, h: 13.6 }, { l: 4.7, t: 47.7, w: 17.4, h: 13.6 }] },
  },
  lseSearch: {
    src: `${P}lse-serp-tall-search-phone-2026-11-08.webp`,
    width: 1500,
    height: 430,
    alt: '',
    caption: 'lawyer seo expert',
    source: 'public/img/proof/lse-serp-lawyer-seo-expert-tall-2026-11-08.webp, x 60 to 1560, y 30 to 460 (2x capture)',
  },
  lseResult: {
    src: `${P}lse-serp-tall-result-phone-2026-11-08.webp`,
    width: 1500,
    height: 425,
    alt: 'Google search for lawyer seo expert in the United States: lawyerseoexpert.com is the first result after the sponsored results',
    caption: 'Google search, United States, 8 November 2026.',
    source: 'public/img/proof/lse-serp-lawyer-seo-expert-tall-2026-11-08.webp, x 60 to 1560, y 2165 to 2590 (2x capture)',
    marks: { title: [{ l: 1.8, t: 60, w: 91, h: 12 }] },
    note: 'Still the old title (an LCME H1): recapture before launch, with lseSerpTall.',
  },
} satisfies Record<string, Proof>;
