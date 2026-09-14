import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import { getAuthProfile } from '../../../../lib/supabase/auth-profile';

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

async function findClub(supabase: any, ref: string) {
  const cleanRef = (ref || '').trim();
  if (!cleanRef) return null;
  if (isUuid(cleanRef)) {
    const { data } = await supabase.from('clubs').select('*').eq('id', cleanRef).maybeSingle();
    if (data) return data;
  }
  const { data } = await supabase.from('clubs').select('*').eq('slug', cleanRef.toLowerCase()).maybeSingle();
  return data || null;
}

async function ownerClient() {
  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('UNAUTHENTICATED');
  const profile = await getAuthProfile(supabase, data.user);
  if (profile.role !== 'OWNER') throw new Error('FORBIDDEN');
  return supabase;
}

function toSourceClub(club: Record<string, unknown>) {
  return { ...club, clubId: club.slug, loaderLogo: club.loader_logo, coverImage: club.cover_image, themeColor: club.theme_color, accentColor: club.accent_color };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createSupabaseAuthServerClient();
    const club = await findClub(supabase, id);
    if (!club) {
      return NextResponse.json({ success: false, message: 'Club not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, club: toSourceClub(club) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load club.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await ownerClient();
    const { id } = await context.params;
    const existing = await findClub(supabase, id);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Club not found.' }, { status: 404 });
    }
    const row = toRow(await request.json());
    if (!row.name || !row.sport || !row.slug) throw new Error('Club Name, Sport, and Slug are required.');
    const { data, error } = await supabase.from('clubs').update(row).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return NextResponse.json({ success: true, club: toSourceClub(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update club.';
    return NextResponse.json({ success: false, message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await ownerClient();
    const { id } = await context.params;
    const existing = await findClub(supabase, id);
    if (!existing) {
      return NextResponse.json({ success: false, message: 'Club not found.' }, { status: 404 });
    }
    const { error } = await supabase.from('clubs').delete().eq('id', existing.id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete club.';
    return NextResponse.json({ success: false, message }, { status: message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400 });
  }
}
