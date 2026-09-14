import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  resolveClub,
  toSourceNotification
} from './notification-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const url = new URL(request.url);
    const clubRef = url.searchParams.get('club') || url.searchParams.get('clubId') || url.searchParams.get('c');

    const adminClient = createAdminSupabaseClient();
    let query = adminClient.from('notifications').select('*');

    query = query.eq('user_id', user.id);

    if (clubRef && clubRef.toLowerCase() !== 'all') {
      const resolved = await resolveClub(adminClient, clubRef);
      query = query.eq('club_id', resolved.id);
    }

    query = query.order('created_at', { ascending: false }).limit(50);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const notifications = rows.map(toSourceNotification);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch notifications.';
    const status = message === 'UNAUTHENTICATED' ? 401 : 400;
    return NextResponse.json(
      { success: false, message, notifications: [], unreadCount: 0 },
      { status }
    );
  }
}
