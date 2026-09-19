import { getSourceSiteData } from '../../lib/source-site-utils';
import SourceSite from '../SourceSite';

/**
 * Universal Dynamic Club Application Shell
 * 
 * Statically exported as /club.html for InfinityFree static hosting.
 * When a visitor navigates to /club/{slug} or /club/{slug}/{section}, Apache
 * rewrites to this file. The client-side SourceSite component detects the slug
 * and section dynamically from window.location, verifies the club with the backend API,
 * and loads the live database content from Supabase.
 */
export default function DynamicClubShell() {
  const { markup, styles, scripts } = getSourceSiteData();
  return <SourceSite markup={markup} styles={styles} scripts={scripts} />;
}
