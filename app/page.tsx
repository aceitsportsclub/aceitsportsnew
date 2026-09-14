import fs from 'node:fs';
import path from 'node:path';
import SourceSite from './SourceSite';
import MasterLandingPage from '../components/landing/MasterLandingPage';

function readSource() {
  return fs.readFileSync(path.join(process.cwd(), 'source', 'HTML.txt'), 'utf8');
}

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

  // If a club query parameter is present (e.g. '/?club=spikers', '/?club=cricket'), render the existing club page!
  const source = readSource();
  const styles = source.match(/<style[^>]*>([\s\S]*?)<\/style>/i)?.[1] ?? '';
  const scripts = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const markup = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1].replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') ?? '';

  return <SourceSite markup={markup} styles={styles} scripts={scripts} />;
}
