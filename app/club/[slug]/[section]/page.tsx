import { notFound } from 'next/navigation';
import { getSourceSiteData } from '../../../../lib/source-site-utils';
import SourceSite from '../../../SourceSite';

export const dynamic = 'force-dynamic';

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
