// The CRM ad landers (/crm-add/ and /crm-add-v2/), ported from WordPress in LSE's voice (owner default,
// FACTS.md section 1). Both versions share this body; only the hero and the order of the two ways to act differ.
// Left out on purpose: the "Sarah Mitchell" testimonial and its 60%/90% figures (an AI portrait with a Gemini
// watermark, FACTS section 5), the two AI-made stock pictures (17.png, 39.png), the "3 spots left" and "3 firms a
// month" scarcity lines (no source), and the WordPress copy-paste line repeated under every example.
// The screenshots are the owner's own design captures of the bankruptcy firm's portal, shown on the live
// pages (research/live/crm-add.html, 1.1.png to 13.png), converted to webp at 1440px wide or less.
import type { FaqItem } from '../Faq.astro';
import type { ShotImage } from '../Shot.astro';

const img = (name: string, width: number, height: number, alt: string, crop?: { top: number; height: number }): ShotImage => ({
  src: `/img/crm/${name}.webp`,
  width,
  height,
  alt,
  ...(crop ? { crop } : {}),
});

export interface CrmExample {
  n: number;
  title: string;
  problem: string;
  builtLead: string;
  built: string[];
  close?: string;
  image: ShotImage;
}

export const examples: CrmExample[] = [
  {
    n: 1,
    title: 'Stop spending hours on leads with no case.',
    problem: 'You send an intake PDF to every lead. Some fill it in. You read each one to see if they qualify, and most of them don’t.',
    builtLead: 'For a bankruptcy firm, we built a qualifying form that checks:',
    built: ['Income against debt thresholds', 'Asset exemption limits', 'Earlier filings', 'Chapter 7 or Chapter 13 eligibility'],
    close: 'The lead fills it in. You read a short summary and decide in seconds.',
    image: img('crm-qualify-form', 1440, 1055, 'The bankruptcy application form we built: guided questions under a step bar, with save and submit buttons'),
  },
  {
    n: 2,
    title: 'Retire the 70-page PDF.',
    problem: 'Clients print it, fill it in by hand and scan it back. Pages go missing, the handwriting is hard to read, and you call them again.',
    builtLead: 'Online forms in guided steps, with a progress bar:',
    built: ['Only the sections that apply to them', 'Saves as they go, so they can finish later', 'Can’t be sent with answers missing'],
    image: img('crm-questionnaire', 1440, 1746, 'A financial questionnaire split into seven sections, each marked complete, in progress or pending', { top: 0, height: 64 }),
  },
  {
    n: 3,
    title: 'Client files on your servers and your computers.',
    problem: 'Files sit across Dropbox, email and local drives. Third-party storage is a risk, nothing is in order, and you keep asking for the same documents.',
    builtLead: 'Two-way document sync:',
    built: [
      'Clients upload to the portal, into the right folder',
      'Each file appears on your computer at once',
      'One client, one local folder',
      'Edit a file on your computer and the portal updates',
      'No third-party servers at all',
    ],
    image: img('crm-client-documents', 1440, 1060, 'The client’s documents page: one upload card per document type, each marked required or optional'),
  },
];

export const dashboards = [
  {
    title: 'Lead dashboard',
    built: ['Start or continue an application', 'See whether they qualify', 'Book a consultation', 'Download guides for their situation', 'Read the answers to common questions'],
    close: 'No access to client areas, so nothing to confuse them.',
    image: img('crm-lead-dashboard', 1440, 1074, 'The lead’s dashboard: start a bankruptcy application, contact the firm, resources and FAQ', { top: 0, height: 74 }),
  },
  {
    title: 'Client dashboard',
    built: ['Upload documents to set folders', 'Fill in the forms assigned to them', 'Follow their case as it moves', 'Book appointments', 'See every file they have sent'],
    close: 'Their case and their documents, always within reach.',
    image: img('crm-client-dashboard', 1440, 1074, 'The client’s dashboard: case progress in four steps, with upload and questionnaire progress bars', { top: 0, height: 74 }),
  },
  {
    title: 'Admin dashboard',
    built: ['Every lead, client and attorney', 'Assign cases to the team', 'Open any document or form', 'Numbers for the whole firm', 'System settings'],
    image: img('crm-admin-clients', 1440, 1073, 'The admin view of clients and leads: name, contact, type, case status and newsletter status in one table', { top: 0, height: 74 }),
  },
  {
    title: 'Attorney dashboard',
    built: ['Only the cases assigned to them', 'Client documents and forms', 'Case notes and status', 'Deadlines', 'Every message with the client'],
    close: 'Each attorney sees their own clients and nothing else.',
  },
] as const satisfies readonly { title: string; built: string[]; close?: string; image?: ShotImage }[];

export const moreExamples: CrmExample[] = [
  {
    n: 5,
    title: 'Run every user from one screen.',
    problem: 'A new hire needs logins everywhere. When someone leaves, you remove access by hand. One wrong permission can expose client data.',
    builtLead: 'One user management panel:',
    built: ['Add attorneys and staff in seconds', 'Set exactly what each person can see', 'Assign or reassign cases in bulk', 'Remove access at once', 'An audit trail of activity'],
    image: img('crm-user-management', 1440, 1073, 'The staff management panel: each attorney and paralegal with a role, and buttons to deactivate or delete them'),
  },
  {
    n: 6,
    title: 'Change your forms without a developer.',
    problem: 'Your intake changes, but your forms are hard-coded. Every edit means paying a developer.',
    builtLead: 'A form manager:',
    built: ['Drag-and-drop form builder', 'Add or remove fields any time', 'Set conditional logic', 'Save forms as templates', 'Keep earlier versions'],
    image: img('crm-form-management', 1440, 824, 'The form manager: the bankruptcy application form and the financial questionnaire, each with its field and submission counts'),
  },
  {
    n: 7,
    title: 'Folders that make sense to clients.',
    problem: '“Where do I upload my W-2?” “Which folder is for medical records?” Every client sorts files in a different way.',
    builtLead: 'Folder management:',
    built: ['Default folders set for every client', 'Clients add a folder when they need one', 'Sort folders and add notes', 'Sync with your local drives'],
    image: img('crm-folders', 1440, 1155, 'The folder manager: seven default document folders, each marked required or optional and active'),
  },
  {
    n: 8,
    title: 'Answer common questions once.',
    problem: 'Different clients ask the same questions. You write the same answers again, and your guides end up scattered.',
    builtLead: 'A resource center:',
    built: ['FAQs for each type of user', 'Upload guides and templates', 'Update once and it changes everywhere'],
    image: img('crm-faq-management', 1243, 1412, 'The FAQ manager: separate questions for clients and for leads, with an edit form and categories', { top: 0, height: 62 }),
  },
];

export const faq: FaqItem[] = [
  { q: 'What exactly do we get?', html: 'A system built for your firm’s own process. Not adapted from someone else’s software: built for you.' },
  {
    q: 'How long does it take?',
    html: 'Four to eight weeks in total. First we share high-fidelity designs of the screens your team and clients will use. Once you approve them, the build starts.',
  },
  {
    q: 'What if we need changes later?',
    html: 'It’s your system, so you can change anything. We can make the change, or your own IT team can. You also get a few months of free maintenance. Small changes cost nothing extra. Bigger changes and new features may cost more, and we agree that with you first.',
  },
  { q: 'Will it work with the software we use now?', html: 'Yes. We connect it to the tools you already use.' },
];
