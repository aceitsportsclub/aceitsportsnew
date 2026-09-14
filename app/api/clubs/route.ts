import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import { getAuthProfile } from '../../../lib/supabase/auth-profile';

function toRow(body: Record<string, unknown>) {
  return {
    name: typeof body.name === 'string' ? body.name.trim() : '',
    sport: typeof body.sport === 'string' ? body.sport.trim() : '',
    slug: typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '',
    logo: body.logo || null,
    loader_logo: body.loaderLogo || null,
    cover_image: body.coverImage || null,
    description: body.description || null,
    theme_color: body.themeColor || null,
    accent_color: body.accentColor || null,
    active: body.active !== false
  };
}

function toSourceClub(club: Record<string, unknown>) {
  return { ...club, clubId: club.slug, loaderLogo: club.loader_logo, coverImage: club.cover_image, themeColor: club.theme_color, accentColor: club.accent_color };
}

export async function GET() {
  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.from('clubs').select('*').eq('active', true).order('name');
  if (error) return NextResponse.json({ success: false, clubs: [], message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, clubs: (data ?? []).map(toSourceClub) });
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('UNAUTHENTICATED');
    const profile = await getAuthProfile(supabase, authData.user);
    if (profile.role !== 'OWNER') throw new Error('FORBIDDEN');
    const row = toRow(await request.json());
    if (!row.name || !row.sport || !row.slug) throw new Error('Club Name, Sport, and Slug are required.');
    const { data, error } = await supabase.from('clubs').insert(row).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, club: toSourceClub(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create club.';
    return NextResponse.json({ success: false, message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400 });
  }
}
