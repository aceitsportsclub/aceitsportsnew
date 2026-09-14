import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile
} from '../../users/user-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user } = await getAuthUserAndProfile(serverClient, request);

    const adminClient = createAdminSupabaseClient();
    const { data: rsvps, error } = await adminClient
      .from('event_rsvps')
      .select('*, events(id, title, date, time, venue, poster)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    const formatted = (rsvps || []).map((r: any) => ({
      id: r.id,
      eventId: r.event_id,
      eventTitle: r.events?.title || r.name || 'Club Event',
      eventDate: r.events?.date || '',
      eventTime: r.events?.time || '',
      eventVenue: r.events?.venue || '',
      eventPoster: r.events?.poster || '',
      status: r.status,
      createdAt: r.created_at
    }));

    return NextResponse.json({ success: true, rsvps: formatted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch user RSVPs';
    return NextResponse.json(
      { success: false, message },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
