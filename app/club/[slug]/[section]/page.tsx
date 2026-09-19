import { notFound } from 'next/navigation';
import { getSourceSiteData } from '../../../../lib/source-site-utils';
import SourceSite from '../../../SourceSite';

const VALID_SECTIONS = [
  'players',
  'team',
  'matches',
  'gallery',
  'events',
  'notice-board',
  'notices',
  'testimonials',
  'stats',
  'contact'
] as const;

const KNOWN_CLUBS = [
  'spikers', 'cricket', 'ballers', 'aceit-ballers',
  'kabaddi', 'strikers', 'volleyball', 'basketball',
  'football', 'badminton'
];

const STATIC_SECTIONS = [
  'players', 'matches', 'gallery', 'events',
  'notice-board', 'testimonials', 'stats', 'contact'
];

// Pre-render all known club×section combinations at build time
export async function generateStaticParams() {
  const params: { slug: string; section: string }[] = [];
  for (const slug of KNOWN_CLUBS) {
    for (const section of STATIC_SECTIONS) {
      params.push({ slug, section });
    }
  }
  return params;
}

// Allow dynamic params for all clubs in Supabase
export const dynamicParams = true;

export default async function ClubSectionPage({
  params
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { slug, section: rawSection } = await params;
  const club = (slug || 'spikers').trim().toLowerCase();
  const section = (rawSection || '').trim().toLowerCase();

  if (!VALID_SECTIONS.includes(section as any)) {
    notFound();
  }

  // Normalize aliases
  const canonicalSection = section === 'team' ? 'players' : (section === 'notices' ? 'notice-board' : section);

  const { markup, styles, scripts } = getSourceSiteData(canonicalSection);

  return <SourceSite markup={markup} styles={styles} scripts={scripts} club={club} section={canonicalSection} />;
}
