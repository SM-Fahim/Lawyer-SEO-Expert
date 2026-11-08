// The two people a firm deals with, for bios and photo rows (kit/Bio.astro, kit/Face.astro). Facts from
// research/FACTS.md section 3. Photos are transparent cutouts, set on the marker swipe.
// Write each page's own lines from its deck; `line` here is a short default.

export interface Person {
  name: string;
  /** Name with non-breaking spaces, for headings. */
  display: string;
  role: string;
  photo: { src: string; width: number; height: number; alt: string };
  line: string;
  href: string;
  linkedin?: string;
}

export const fahim: Person = {
  name: 'S. M. Fahim',
  display: 'S. M. Fahim',
  role: 'Law firm SEO expert',
  photo: { src: '/img/people/fahim.webp', width: 720, height: 716, alt: 'S. M. Fahim' },
  line: 'Fahim leads every account, joins every call and reviews all the work. A small team helps with production.',
  href: '/about/sm-fahim/',
  linkedin: 'https://www.linkedin.com/in/sm-fahim/',
};

export const josh: Person = {
  name: 'Josh Henderson',
  display: 'Josh Henderson',
  role: 'Sales Director',
  photo: { src: '/img/people/josh.webp', width: 720, height: 707, alt: 'Josh Henderson' },
  line: 'Texas attorney since 2008, and an advisor to more than 50 law firms. Josh joins calls with firms.',
  href: '/about/josh-henderson/',
};

export const people = { fahim, josh };
