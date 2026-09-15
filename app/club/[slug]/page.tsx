import { getSourceSiteData } from '../../../lib/source-site-utils';
import SourceSite from '../../SourceSite';

export const dynamic = 'force-dynamic';

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
