// Client logos for the trust line only (FACTS section 4: never in result text or headings).
// `h` is the display height in px that balances the four marks optically.

export interface Logo {
  src: string;
  width: number;
  height: number;
  alt: string;
  h: number;
}

export const trustLogos: readonly Logo[] = [
  { src: '/img/logos/rudin-ink.webp', width: 108, height: 120, alt: 'Rudin Law logo', h: 46 },
  { src: '/img/logos/915-ink.webp', width: 602, height: 120, alt: '915 Injury logo', h: 34 },
  { src: '/img/logos/cohen-ink.webp', width: 237, height: 120, alt: 'Cohen & Cohen logo', h: 40 },
  { src: '/img/logos/dedert-ink.webp', width: 248, height: 39, alt: 'Dedert logo', h: 21 },
];
