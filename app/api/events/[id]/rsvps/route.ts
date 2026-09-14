import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  isUuid
} from '../../../users/user-utils';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    const serverClient = await createSupabaseAuthServerClient();
    await getAuthUserAndProfile(serverClient, request);

    if (!isUuid(eventId)) {
      return NextResponse.json({ success: true, rsvps: [] });
    }

    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('event_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      rsvps: (data || []).map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        name: r.name || 'Student Athlete',
        email: r.email || '',
        phone: r.mobile || '',
        status: r.status,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch event RSVPs';
    return NextResponse.json(
      { success: false, message },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
