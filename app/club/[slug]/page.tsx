import { getSourceSiteData } from '../../../lib/source-site-utils';
import SourceSite from '../../SourceSite';

// Pre-render all known club home pages at build time for static hosting
export async function generateStaticParams() {
  return [
    { slug: 'spikers' },
    { slug: 'cricket' },
    { slug: 'ballers' },
    { slug: 'aceit-ballers' },
    { slug: 'kabaddi' },
    { slug: 'strikers' },
    { slug: 'volleyball' },
    { slug: 'basketball' },
    { slug: 'football' },
    { slug: 'badminton' },
  ];
}

// Allow dynamic params for all clubs in Supabase
export const dynamicParams = true;

export default async function ClubHomePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const club = (slug || 'spikers').trim().toLowerCase();
  const { markup, styles, scripts } = getSourceSiteData();

  return <SourceSite markup={markup} styles={styles} scripts={scripts} club={club} section="home" />;
}
