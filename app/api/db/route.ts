import { NextResponse } from 'next/server';
import { CONTENT_TABLES, readContent, sourceKeys, syncContent } from '../../../lib/supabase/data-server';

function getClubId(request: Request): string | null {
  const clubId = new URL(request.url).searchParams.get('clubId')?.trim().toLowerCase();
  return clubId || null;
}

export async function GET(request: Request) {
  try {
    let clubId = getClubId(request);
    if (!clubId) {
      return NextResponse.json({ success: false, message: 'Club identifier is required.' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const cookieHeader = request.headers.get('cookie') || '';
    const hasPotentialAuth = Boolean(authHeader || cookieHeader.includes('sb-'));
    let isPersonalizedOrAuthenticated = false;

    if (clubId === 'all' || hasPotentialAuth) {
      try {
        const { createSupabaseAuthServerClient } = await import('../../../lib/supabase/auth-server');
        const { getAuthUserAndProfile } = await import('../users/user-utils');
        const serverClient = await createSupabaseAuthServerClient();
        const { user, profile } = await getAuthUserAndProfile(serverClient, request);
        if (user || profile) {
          isPersonalizedOrAuthenticated = true;
        }
        if (profile && profile.role !== 'OWNER') {
          const userClubs = profile.clubs || [];
          const userPrimaryClub = profile.clubId && profile.clubId !== 'ALL' ? profile.clubId : (userClubs[0] || 'spikers');
          if (clubId === 'all' || (!userClubs.includes(clubId) && userPrimaryClub)) {
            clubId = userPrimaryClub;
          }
        }
      } catch {
        if (clubId === 'all') clubId = 'spikers';
      }
    }

    const url = new URL(request.url);
    const isExport = url.searchParams.get('export') === '1' || url.searchParams.get('export') === 'true';
    const section = isExport
      ? undefined
      : (url.searchParams.get('section')?.trim().toLowerCase() ||
         url.searchParams.get('module')?.trim().toLowerCase() ||
         undefined);
    const rawLimit = url.searchParams.get('limit');
    const limit = rawLimit && /^\d+$/.test(rawLimit) ? parseInt(rawLimit, 10) : undefined;

    const data = await readContent(clubId, undefined, section ? { section, limit } : undefined);

    if (isExport) {
      return NextResponse.json(
        {
          success: true,
          clubId,
          exportedAt: new Date().toISOString(),
          version: '1.0',
          data
        },
        {
          headers: {
            'Cache-Control': 'private, no-cache, no-store, max-age=0, must-revalidate',
            'CDN-Cache-Control': 'no-store',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Vary': 'Accept-Encoding, Authorization, Cookie'
          }
        }
      );
    }

    return NextResponse.json(
      { success: true, data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'CDN-Cache-Control': 'no-store',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': 'Accept-Encoding, Authorization, Cookie'
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load club data.';
    const status = message === 'UNAUTHENTICATED' ? 401 : (message === 'CLUB_NOT_FOUND' || message === 'CLUB_REQUIRED' ? 404 : 500);
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, message: 'Malformed JSON payload.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Invalid payload. Expected a JSON object.' }, { status: 400 });
    }

    // Security: Never allow importing authentication or permission credentials
    if ('password' in body || 'service_role_key' in body || 'users' in body || 'user_roles' in body) {
      delete body.password;
      delete body.service_role_key;
      delete body.users;
      delete body.user_roles;
    }

    // Validate structured module types
    for (const table of CONTENT_TABLES) {
      const key = sourceKeys[table];
      if ((key in body && !Array.isArray(body[key])) || (table in body && !Array.isArray(body[table]))) {
        return NextResponse.json({
          success: false,
          message: `Malformed structure for module '${key}'. Expected an array.`
        }, { status: 400 });
      }
    }

    const url = new URL(request.url);
    const queryClub = url.searchParams.get('clubId')?.trim().toLowerCase();
    const bodyClub = typeof body.clubId === 'string' ? body.clubId.trim().toLowerCase() : '';
    const rawClubId = queryClub || bodyClub;

    let resolvedClubId = rawClubId;
    if (!resolvedClubId || resolvedClubId === 'all') {
      try {
        const { createSupabaseAuthServerClient } = await import('../../../lib/supabase/auth-server');
        const { getAuthUserAndProfile } = await import('../users/user-utils');
        const serverClient = await createSupabaseAuthServerClient();
        const { profile } = await getAuthUserAndProfile(serverClient, request);
        if (profile && profile.role !== 'OWNER') {
          const userClubs = profile.clubs || [];
          const userPrimaryClub = profile.clubId && profile.clubId !== 'ALL' ? profile.clubId : (userClubs[0] || 'spikers');
          resolvedClubId = userPrimaryClub;
        }
      } catch { }
    }

    if (!resolvedClubId) {
      return NextResponse.json({ success: false, message: 'Club identifier is required.' }, { status: 400 });
    }


    const rawModule = body.__saveModule || body.module || url.searchParams.get('module');
    const saveModule = typeof rawModule === 'string' && rawModule.trim() ? rawModule.trim().toLowerCase() : undefined;

    const data = await syncContent(resolvedClubId, body, request, saveModule);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save club data.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
