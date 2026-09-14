import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import { getAuthProfile } from '../../../lib/supabase/auth-profile';

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { contentType: match[1], data: Buffer.from(match[2], 'base64') };
}

function extensionFor(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

function clubSlugFromFolder(folder: string) {
  const normalized = folder.trim().toLowerCase().replace(/^aceit_/, '').replace(/[^a-z0-9-]/g, '-');
  return normalized || 'spikers';
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

    let supabase = serverClient;
    let authUser = null;

    if (token) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
      if (url && key) {
        const { createClient } = await import('@supabase/supabase-js');
        const tokenClient = createClient(url, key, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });
        const { data: userData } = await tokenClient.auth.getUser(token);
        if (userData?.user) {
          authUser = userData.user;
          supabase = tokenClient as any;
        }
      }
    }

    if (!authUser) {
      const { data: authData, error: authError } = await serverClient.auth.getUser();
      if (authError || !authData.user) throw new Error('UNAUTHENTICATED');
      authUser = authData.user;
    }

    const profile = await getAuthProfile(supabase, authUser);
    const body = await request.json();
    const source = typeof body.image === 'string' ? body.image : '';
    const parsed = parseDataUrl(source);
    if (!parsed) throw new Error('INVALID_IMAGE');

    const rawClubRef = typeof body.clubId === 'string'
      ? body.clubId
      : (typeof body.club === 'string' ? body.club : (typeof body.folder === 'string' ? body.folder : 'spikers'));
    const clubSlug = clubSlugFromFolder(rawClubRef);

    let club = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawClubRef.trim())) {
      const byId = await supabase.from('clubs').select('id, slug').eq('id', rawClubRef.trim()).maybeSingle();
      if (byId.data) club = byId.data;
    }
    if (!club) {
      const bySlug = await supabase.from('clubs').select('id, slug').eq('slug', clubSlug).maybeSingle();
      if (bySlug.data) club = bySlug.data;
    }
    if (!club) throw new Error('CLUB_NOT_FOUND');
    if (profile.role !== 'OWNER' && !profile.clubs.includes(club.id)) throw new Error('FORBIDDEN');

    const allowedBuckets = ['player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos'];
    const url = new URL(request.url);
    const requestedBucket = (typeof body.bucket === 'string' ? body.bucket : '') || url.searchParams.get('bucket');
    const folderHint = (typeof body.folder === 'string' ? body.folder.toLowerCase() : '') || (url.searchParams.get('folder') || '').toLowerCase();
    const moduleHint = (typeof body.module === 'string' ? body.module.toLowerCase() : '') || (url.searchParams.get('module') || '').toLowerCase();

    let bucket = 'player-photos';
    if (requestedBucket && allowedBuckets.includes(requestedBucket)) {
      bucket = requestedBucket;
    } else if (folderHint === 'gallery' || folderHint === 'gallery-media' || folderHint.includes('gallery') || moduleHint === 'gallery') {
      bucket = 'gallery-media';
    } else if (folderHint === 'events' || folderHint === 'event-posters' || folderHint.includes('event') || moduleHint === 'events') {
      bucket = 'event-posters';
    }
    const path = `${club.slug}/${crypto.randomUUID()}.${extensionFor(parsed.contentType)}`;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    let storageClient = supabase;
    if (serviceKey && supabaseUrl) {
      const { createClient } = await import('@supabase/supabase-js');
      storageClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;
    }

    const { error: uploadError } = await storageClient.storage.from(bucket).upload(path, parsed.data, { contentType: parsed.contentType, upsert: false });
    if (uploadError) throw uploadError;

    const { data } = storageClient.storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({ success: true, url: data.publicUrl, path, bucket });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload image.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
