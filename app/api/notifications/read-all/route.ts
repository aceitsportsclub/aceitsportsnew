import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  resolveClub
} from '../notification-utils';

export async function PUT(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile } = await getAuthUserAndProfile(serverClient, request);

    const url = new URL(request.url);
    const clubRef = url.searchParams.get('club') || url.searchParams.get('clubId');

    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('notifications')
      .update({ read: true })
      .eq('read', false);

    if (profile.role === 'OWNER') {
      if (clubRef && clubRef.toLowerCase() !== 'all') {
        const resolved = await resolveClub(adminClient, clubRef);
        query = query.eq('club_id', resolved.id);
      } else {
        query = query.eq('user_id', user.id);
      }
    } else {
      query = query.eq('user_id', user.id);
      if (clubRef && clubRef.toLowerCase() !== 'all') {
        const resolved = await resolveClub(adminClient, clubRef);
        query = query.eq('club_id', resolved.id);
      }
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to mark all notifications as read.';
    const status = message === 'UNAUTHENTICATED' ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
