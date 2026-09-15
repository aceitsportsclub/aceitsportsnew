import SourceSite from './SourceSite';
import MasterLandingPage from '../components/landing/MasterLandingPage';
import { getSourceSiteData } from '../lib/source-site-utils';

export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawClub = sp.club || sp.clubId || sp.c;
  const club = (typeof rawClub === 'string' ? rawClub : (Array.isArray(rawClub) ? rawClub[0] : '')).trim().toLowerCase();

  // If no club query parameter is present (e.g. '/'), render the MASTER LANDING PAGE!
  if (!club) {
    return <MasterLandingPage />;
  }

  // Support optional section parameter (e.g. '/?club=spikers&section=players')
  const rawSection = sp.section || sp.view || sp.page;
  const section = (typeof rawSection === 'string' ? rawSection : (Array.isArray(rawSection) ? rawSection[0] : '')).trim().toLowerCase() || 'home';

  const { markup, styles, scripts } = getSourceSiteData(section);

  return <SourceSite markup={markup} styles={styles} scripts={scripts} club={club} section={section} />;
}
