// Every proof capture on the site, in one list. Pages import an entry and turn it into a Shot image with
// `shot()`, so nobody retypes a size, an alt text or a mark box.
//
// Files: public/img/proof/, webp, at their real size (never upscaled). Captures already shown on LCME are used
// as they are (owner, FACTS section 4). Crops are plain rectangles, and nothing else changes pixels.
// Marks: boxes in % of the whole image ({ l, t, w, h }), measured from its pixels around the exact text.
// Crops: bands in % of the image's height ({ top, height }), for Shot's `crop`.
// Captions never name a firm. Alt text says what the capture proves.
// `deckNames`: other names the v2 decks use for the same file. A deck that names one of them means this entry.
import type { MarkBox, ShotImage } from '../components/Shot.astro';

export interface Crop {
  top: number;
  height: number;
}

export interface Proof {
  src: string;
  width: number;
  height: number;
  /** What the capture proves. Empty only for a context strip (a search box shown above its result). */
  alt: string;
  /** A default caption in plain words. Pages may write their own from their deck. */
  caption: string;
  /** Where the file came from. */
  source: string;
  marks?: Record<string, MarkBox[]>;
  crops?: Record<string, Crop>;
  deckNames?: string[];
  /** Anything a builder must know before using it. */
  note?: string;
}

const P = '/img/proof/';

export const proof = {
  // ---------- Calls (Google Business Profile) ----------
  nolaCalls: {
    src: `${P}nola-calls-jun-oct-2026.webp`,
    width: 1077,
    height: 582,
    alt: 'Google Business Profile: 139 calls from June to October 2026, up 39% on the same months of 2025',
    caption: 'A PI firm in New Orleans. Google counted 139 calls from its Business Profile in five months, 39% more than a year before.',
    source: 'LCME public/img/calls-rudin-oct.webp',
    marks: {
      total: [{ l: 3.4, t: 33.2, w: 7.8, h: 9.4 }],
      growth: [{ l: 3.6, t: 47.6, w: 7.5, h: 4.4 }],
      september: [{ l: 74.8, t: 57, w: 10, h: 10 }],
    },
    // The September point and its label sit in the middle of this band (the bankruptcy hero).
    crops: { chart: { top: 52, height: 48 } },
    deckNames: ['calls-rudin-oct.webp', 'nola-calls-sep-2026.webp', 'nola-calls-jun-oct-2026-sep.webp'],
    note: 'The only 139 chart: its September point is open at "43 September 2026". There is no version without the label, so decks asking for "the tooltip version" mean this file. The September mark sits on a blue label, where the highlighter reads darker.',
  },
  elpasoCallsBefore: {
    src: `${P}elpaso-calls-before.webp`,
    width: 1200,
    height: 649,
    alt: 'Google Business Profile: 9 calls from August 2025 to January 2026',
    caption: 'Before us: Aug 2025 to Jan 2026',
    source: 'LCME public/img/calls-ep-before.webp',
    marks: { total: [{ l: 3.9, t: 34, w: 2.9, h: 9 }] },
    deckNames: ['calls-ep-before.webp'],
  },
  elpasoCallsAfter: {
    src: `${P}elpaso-calls-after.webp`,
    width: 1347,
    height: 727,
    alt: 'Google Business Profile: 23 calls from May to July 2026, rising every month',
    caption: 'With us: May to Jul 2026',
    source: 'LCME public/img/calls-ep-after.webp',
    marks: {
      total: [{ l: 3.7, t: 34, w: 5.6, h: 9 }],
      range: [{ l: 41.3, t: 13.8, w: 11.9, h: 3.3 }],
    },
    deckNames: ['calls-ep-after.webp'],
  },
  newProfileCalls: {
    src: `${P}new-profile-calls.webp`,
    width: 1067,
    height: 571,
    alt: 'Google Business Profile for a new profile: calls from June to October 2026, rising from about 1 in July to 9 in October',
    caption: 'A new Google profile went from 1 call in July to 9 in October.',
    source: 'LCME public/img/calls-new-profile.webp',
    marks: { points: [{ l: 26.4, t: 85.6, w: 4.4, h: 6 }, { l: 93.2, t: 54.6, w: 5, h: 6.4 }] },
    deckNames: ['calls-new-profile.webp'],
  },

  // ---------- Rankings and Google's AI answers ----------
  nolaWtdQuery: {
    src: `${P}nola-wtd-query.webp`,
    width: 976,
    height: 67,
    alt: '',
    caption: 'what to do after a truck accident in New Orleans',
    source: 'LCME public/img/p16-wtd-query.webp',
    deckNames: ['p16-wtd-query.webp'],
    note: 'A search box strip: stack it over nola-wtd-rank or nola-wtd-ai in one Shot.',
  },
  nolaWtdRank: {
    src: `${P}nola-wtd-rank.webp`,
    width: 900,
    height: 162,
    alt: 'The page in Google’s results, stamped 16 hours ago',
    caption: 'Ranked #1 on Google 16 hours after going live, after about three months of groundwork.',
    source: 'LCME public/img/p16-wtd-rank.webp',
    marks: { age: [{ l: 1.6, t: 63.5, w: 12.2, h: 16 }] },
    deckNames: ['p16-wtd-rank.webp'],
    note: '"16 hours" always travels with "after about three months of groundwork".',
  },
  nolaWtdAi: {
    src: `${P}nola-wtd-ai.webp`,
    width: 900,
    height: 776,
    alt: 'Google’s AI answer citing the firm’s page on recorded statements and Louisiana filing deadlines',
    caption: 'Quoted 3 times in Google’s AI answer.',
    source: 'LCME public/img/p16-wtd-ai.webp',
    marks: { citations: [{ l: 60, t: 25.8, w: 14.4, h: 3.2 }, { l: 14.1, t: 48.9, w: 11.8, h: 3.3 }, { l: 61.4, t: 63.3, w: 11.9, h: 3.1 }] },
    deckNames: ['p16-wtd-ai.webp', 'ai-wtd.webp'],
  },
  nolaJackknife: {
    src: `${P}nola-jackknife.webp`,
    width: 1022,
    height: 625,
    alt: 'Google search for jackknife truck accident Louisiana: the firm’s page is the first result, 7 days after going live, and cited in the AI Overview',
    caption: 'Ranked #1. A week on, Google’s AI still cites it.',
    source: 'LCME public/img/p16-jackknife.webp',
    marks: {
      aiChip: [{ l: 39.9, t: 50.3, w: 8.7, h: 3.8 }],
      result: [{ l: 1.9, t: 88.4, w: 40, h: 4 }],
      sourceCard: [{ l: 67.7, t: 49.3, w: 21.5, h: 8.6 }],
    },
    deckNames: ['p16-jackknife.webp', 'ai-jackknife.webp'],
    note: 'An open source popup covers part of the AI panel, so the sourceCard mark is partly hidden: prefer aiChip and result.',
  },
  elpasoAiDeadline: {
    src: `${P}elpaso-ai-deadline.webp`,
    width: 1400,
    height: 849,
    alt: 'Google’s AI Overview for Texas El Paso car accident filing deadline, with an El Paso PI firm’s page as the first source',
    caption: 'For a PI firm in El Paso, its page is the first source Google’s AI answer cites.',
    source: 'LCME public/img/ai-915.webp',
    marks: {
      citedLine: [{ l: 5.1, t: 35.3, w: 33.9, h: 2.6 }],
      sourceCard: [{ l: 69.6, t: 35.4, w: 24, h: 3.2 }],
    },
    deckNames: ['ai-915.webp', 'p16-915-ai.webp'],
    note: 'LCME has two versions; this is ai-915 (search box included). Decks that say p16-915-ai mean this file.',
  },
  nolaKeyFirm: {
    src: `${P}nola-key-firm.webp`,
    width: 790,
    height: 358,
    alt: 'Google’s AI Overview for tanker truck accident lawyer in New Orleans, listing a New Orleans PI firm among key legal firms, rated 5.0 from 317 reviews',
    caption: 'Google’s AI lists a PI firm in New Orleans as a key firm for tanker accidents.',
    source: 'LCME public/img/aio-tanker-main.webp',
    marks: {
      aiChip: [{ l: 8.6, t: 40.4, w: 13.6, h: 6.4 }],
      heading: [{ l: 3.2, t: 56.1, w: 75.6, h: 6.7 }],
      firmRow: [{ l: 18.4, t: 68.5, w: 11.2, h: 6.2 }, { l: 18.4, t: 75.6, w: 19.2, h: 6.2 }],
    },
    crops: { answer: { top: 0, height: 50 }, keyFirms: { top: 50, height: 50 } },
    deckNames: ['aio-tanker-main.webp'],
  },
  nolaTankerQuery: {
    src: `${P}nola-tanker-query.webp`,
    width: 976,
    height: 67,
    alt: '',
    caption: 'Tanker Truck Accident Lawyer in New Orleans',
    source: 'LCME public/img/p16-tanker-query.webp',
    deckNames: ['p16-tanker-query.webp'],
    note: 'A search box strip: stack it over nola-tanker-rank in one Shot.',
  },
  nolaTankerRank: {
    src: `${P}nola-tanker-rank.webp`,
    width: 900,
    height: 175,
    alt: 'A New Orleans PI firm’s page in Google’s results for tanker truck accident lawyer in New Orleans, stamped 16 hours ago',
    caption: 'Ranked #3 on Google 16 hours after going live, after about three months of groundwork.',
    source: 'LCME public/img/p16-tanker-rank.webp',
    marks: {
      title: [{ l: 1.6, t: 33, w: 63.6, h: 20 }],
      age: [{ l: 1.8, t: 57, w: 12.6, h: 14.5 }],
      address: [{ l: 7.6, t: 16.5, w: 26, h: 11 }],
    },
    deckNames: ['p16-tanker-rank.webp'],
    note: 'This page ranked #3. Never tag it "#1".',
  },
  nolaTankerAi: {
    src: `${P}nola-tanker-ai.webp`,
    width: 665,
    height: 352,
    alt: 'Google’s AI answer for tanker accidents in New Orleans, with a PI firm listed under key legal firms, rated 5.0 from 317 reviews',
    caption: 'For tanker accidents in New Orleans, Google’s AI lists the firm as a key firm, at 5.0 stars from 317 reviews.',
    source: 'LCME public/img/p16-tanker-ai.webp, cropped to the left column (the answer and the key firms list)',
    marks: {
      heading: [{ l: 2, t: 46.3, w: 78, h: 6.2 }],
      name: [{ l: 18.3, t: 59.1, w: 11.1, h: 5.1 }],
      rating: [{ l: 18.3, t: 66.5, w: 19.2, h: 4.5 }],
    },
    deckNames: ['p16-tanker-ai.webp'],
    note: 'The services deck prefers a fresh LSE-only Business Profile capture when one exists (placeholder until then).',
  },
  nolaTankerSerpFull: {
    src: `${P}nola-tanker-serp-full.webp`,
    width: 1440,
    height: 975,
    alt: 'Google’s whole results page for tanker truck accident lawyer in New Orleans: a PI firm is cited in the AI answer, listed under key legal firms and shown as a source card',
    caption: 'One search, and the firm is named three times: in the AI answer, among the key firms and as a source.',
    source: 'LCME public/img/aio-tanker-full.webp',
    marks: {
      aiChip: [{ l: 18.9, t: 40.7, w: 5.6, h: 1.4 }],
      firmRow: [{ l: 22.9, t: 48.8, w: 7.7, h: 3.8 }],
      sourceCard: [{ l: 60, t: 47.4, w: 14, h: 5.1 }],
    },
    deckNames: ['aio-tanker-full.webp'],
    note: 'Shown at 1440px the text is small: give it the full content width, or crop with `crops.results`.',
    crops: { results: { top: 28, height: 36 } },
  },

  // ---------- Our own ranking ----------
  lseSerp: {
    src: `${P}lse-serp-lawyer-seo-expert-2026-11-08.webp`,
    width: 1800,
    height: 920,
    alt: 'Google search for lawyer seo expert in the United States: lawyerseoexpert.com is the first result under the sponsored results',
    caption: 'Google search, United States, 8 November 2026.',
    source: 'research/proof/serp-lawyer-seo-expert-us-2026-11-08-tight.png',
    marks: { title: [{ l: 9.7, t: 30.6, w: 76.4, h: 7.6 }] },
    crops: { result: { top: 15, height: 46 } },
    note: 'The homepage uses this one. The capture still shows the old title; recapture once the new one is live.',
  },
  lseSerpTall: {
    src: `${P}lse-serp-lawyer-seo-expert-tall-2026-11-08.webp`,
    width: 2060,
    height: 3100,
    alt: 'Google search for lawyer seo expert in the United States: lawyerseoexpert.com is the first organic result, with the AI Overview below it',
    caption: 'Google search, United States, 8 November 2026.',
    source: 'research/proof/serp-lawyer-seo-expert-us-2026-11-08-tall.png, cropped to the results column (2x capture)',
    marks: { title: [{ l: 4.4, t: 77.9, w: 66.2, h: 1.95 }] },
    // Two bands in one Shot "collapse" the sponsored block to its label without editing a pixel:
    // the search box down to "Sponsored Results", then "Hide sponsored results" down to the AI Overview.
    crops: { search: { top: 0, height: 15.6 }, result: { top: 70, height: 30 } },
    deckNames: ['serp-lawyer-seo-expert-us-2026-11-08-tall.png'],
    note: 'Use the two crops as two images in one Shot (docs/kit.md). The ads are never shown, so nothing needs blurring. Still the old title "Our Own Ranking Proves We Can Deliver" (an LCME H1): recapture before launch.',
  },

  // ---------- Sites we built ----------
  elpasoSiteMobile: {
    src: `${P}elpaso-site-mobile.webp`,
    width: 824,
    height: 1760,
    alt: 'A website we built for a PI firm in El Paso, on a phone',
    caption: 'The El Paso firm’s site, which we built, on a phone.',
    source: 'LCME public/img/site-915-mobile.webp',
    deckNames: ['site-915-mobile.webp', 'elpaso-site-phone.webp'],
  },
  nolaSiteHomeDesktop: {
    src: `${P}nola-site-home-desktop.webp`,
    width: 1440,
    height: 900,
    alt: 'The home page of a website we built for a PI firm in New Orleans, on a desktop screen',
    caption: 'A site we built for a PI firm in New Orleans.',
    source: 'research/proof/client-getrude-home-desktop-1440-2026-11-08.png',
    marks: {
      searchLine: [{ l: 4.9, t: 22.4, w: 28.3, h: 2.2 }],
      callButton: [{ l: 80.5, t: 12, w: 15, h: 8 }],
    },
    note: 'A dark and gold site: the highlighter reads weakly on it. Use at most one mark, or a tag only.',
  },
  nolaSiteHomePhone: {
    src: `${P}nola-site-home-phone.webp`,
    width: 780,
    height: 1688,
    alt: 'The same New Orleans PI firm’s website on a phone',
    caption: 'The same site on a phone.',
    source: 'research/proof/client-getrude-home-mobile-390-2026-11-08.png (a 4x capture of one 390px screen, halved)',
    deckNames: ['client-getrude-home-mobile-390-2026-11-08.png'],
  },
  nolaSiteCarAccidentPage: {
    src: `${P}nola-site-car-accident-page.webp`,
    width: 1440,
    height: 900,
    alt: 'A car accident practice page we built for a PI firm in New Orleans, with its headline, call button and contact form',
    caption: 'A practice page we built for a PI firm in New Orleans.',
    source: 'research/proof/client-getrude-car-accidents-page-desktop-1440-2026-11-08.png',
    marks: {
      headline: [{ l: 4.7, t: 43, w: 28.5, h: 21 }],
      formHeading: [{ l: 56.7, t: 40.4, w: 14.5, h: 2.2 }],
      callButton: [{ l: 4.9, t: 95.3, w: 26.4, h: 4.7 }],
    },
    deckNames: ['client-getrude-car-accidents-page-desktop-1440-2026-11-08.png'],
    note: 'A dark site: marks read weakly. It is a build, not a ranking, so no rank tag.',
  },

  // ---------- Before law firms (Fahim's record, may be named) ----------
  idiyaSales: {
    src: `${P}idiya-sales-reports.webp`,
    width: 1200,
    height: 720,
    alt: 'Idiya’s online store reports for two periods, with the total sales of each marked',
    caption: 'Idiya’s store reports for two periods, total sales marked.',
    source: 'LCME public/img/tr-idiya-sales.webp',
    marks: { totals: [{ l: 49.6, t: 35.4, w: 13.1, h: 5.2 }, { l: 50, t: 79.9, w: 12.7, h: 5.1 }] },
    deckNames: ['tr-idiya-sales.webp'],
    note: 'Shows 460,362.90 and 2,318,124.28 in total sales, not the $900K and $2.7M in FACTS (owner question in the about-sm-fahim deck). A caption with the amounts needs them in PRICES_BY_PAGE.',
  },
  breakthroughTraffic: {
    src: `${P}breakthrough-traffic.webp`,
    width: 1400,
    height: 570,
    alt: 'Semrush organic traffic for Breakthrough Maths: 18,980 visits a month, rising from near zero over two years',
    caption: 'Breakthrough Maths: from near zero to 19K visits a month.',
    source: 'LCME public/img/tr-breakthrough-traffic.webp, cropped to the traffic line and chart (Authority Score, backlinks and referring domains cut out)',
    marks: { traffic: [{ l: 19.3, t: 24.2, w: 15.3, h: 6.1 }] },
    deckNames: ['tr-breakthrough-traffic.webp'],
  },
} satisfies Record<string, Proof>;

export type ProofKey = keyof typeof proof;

export interface ShotOptions {
  /** Names from the entry's `marks`, or your own boxes. Default: no marks. */
  marks?: string[] | MarkBox[];
  /** A name from the entry's `crops`, or your own band. */
  crop?: string | Crop;
  /** Overrides the entry's alt text (say what this crop proves). */
  alt?: string;
}

/** One proof entry as a Shot image. */
export function shot(entry: Proof, options: ShotOptions = {}): ShotImage {
  const { marks = [], crop, alt } = options;
  const boxes = marks.flatMap((m) => {
    if (typeof m !== 'string') return [m];
    const named = entry.marks?.[m];
    if (!named) throw new Error(`proof: ${entry.src} has no mark "${m}"`);
    return named;
  });
  const band = typeof crop === 'string' ? entry.crops?.[crop] : crop;
  if (typeof crop === 'string' && !band) throw new Error(`proof: ${entry.src} has no crop "${crop}"`);
  return {
    src: entry.src,
    width: entry.width,
    height: entry.height,
    alt: alt ?? entry.alt,
    ...(boxes.length ? { marks: boxes } : {}),
    ...(band ? { crop: band } : {}),
  };
}
