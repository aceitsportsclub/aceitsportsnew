import { NextResponse } from 'next/server';
import { CONTENT_TABLES, sourceKeys, syncContent } from '../../../lib/supabase/data-server';

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

    // Security: Strip sensitive authentication and credentials
    delete body.password;
    delete body.service_role_key;
    delete body.users;
    delete body.user_roles;

    // Validate structured module types
    for (const table of CONTENT_TABLES) {
      const key = sourceKeys[table];
      if (key in body && !Array.isArray(body[key])) {
        return NextResponse.json({
          success: false,
          message: `Malformed structure for module '${key}'. Expected an array.`
        }, { status: 400 });
      }
    }

    const url = new URL(request.url);
    const rawClubId = url.searchParams.get('clubId') || body.clubId;
    let clubId = typeof rawClubId === 'string' ? rawClubId.trim().toLowerCase() : '';

    if (!clubId || clubId === 'all') {
      try {
        const { createSupabaseAuthServerClient } = await import('../../../lib/supabase/auth-server');
        const { getAuthUserAndProfile } = await import('../users/user-utils');
        const serverClient = await createSupabaseAuthServerClient();
        const { profile } = await getAuthUserAndProfile(serverClient, request);
        if (profile && profile.role !== 'OWNER') {
          const userClubs = profile.clubs || [];
          const userPrimaryClub = profile.clubId && profile.clubId !== 'ALL' ? profile.clubId : (userClubs[0] || 'spikers');
          clubId = userPrimaryClub;
        }
      } catch { }
    }

    if (!clubId) {
      return NextResponse.json({ success: false, message: 'Club identifier is required.' }, { status: 400 });
    }


    const rawModule = body.__saveModule || body.module || url.searchParams.get('module');
    let saveModule = typeof rawModule === 'string' && rawModule.trim() ? rawModule.trim().toLowerCase() : undefined;

    // If saveModule is not explicitly provided, detect if only one content table has items in body
    if (!saveModule) {
      const activeModules = CONTENT_TABLES.filter((table) => {
        const key = sourceKeys[table];
        return Object.prototype.hasOwnProperty.call(body, key) && Array.isArray(body[key]) && body[key].length > 0;
      });
      if (activeModules.length === 1) {
        saveModule = activeModules[0];
      }
    }

    const data = await syncContent(clubId, body, request, saveModule);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save club data.';
    console.error('[save-all] failed', {
      message,
      error: error instanceof Error ? error.stack : error
    });
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
