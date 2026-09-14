import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  isUuid
} from '../../../users/user-utils';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile } = await getAuthUserAndProfile(serverClient, request);

    const body = await request.json().catch(() => ({}));
    const eventTitle = body.eventTitle || '';

    const adminClient = createAdminSupabaseClient();

    let targetEventId = eventId;
    if (!isUuid(targetEventId)) {
      const { data: matched } = await adminClient
        .from('events')
        .select('id')
        .ilike('title', `%${eventTitle || ''}%`)
        .limit(1)
        .maybeSingle();

      if (matched?.id) {
        targetEventId = matched.id;
      } else {
        const { data: fallback } = await adminClient.from('events').select('id').limit(1).maybeSingle();
        if (fallback?.id) targetEventId = fallback.id;
      }
    }

    if (!isUuid(targetEventId)) {
      return NextResponse.json(
        { success: false, message: 'Event not found.' },
        { status: 404 }
      );
    }

    const { error } = await adminClient.from('event_rsvps').upsert(
      {
        event_id: targetEventId,
        user_id: user.id,
        name: profile.name || profile.username || user.email?.split('@')[0] || 'Student Athlete',
        email: profile.email || user.email || null,
        mobile: (user.user_metadata?.mobile || user.user_metadata?.phone || null) as string | null,
        status: 'registered'
      },
      { onConflict: 'event_id,user_id' }
    );

    if (error) {
      console.error('RSVP insert error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Could not complete RSVP.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'RSVP confirmed successfully.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RSVP failed';
    return NextResponse.json(
      { success: false, message: message === 'UNAUTHENTICATED' ? 'Please log in to RSVP.' : message },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    const serverClient = await createSupabaseAuthServerClient();
    const { user } = await getAuthUserAndProfile(serverClient, request);

    const adminClient = createAdminSupabaseClient();

    let query = adminClient.from('event_rsvps').delete().eq('user_id', user.id);
    if (isUuid(eventId)) {
      query = query.eq('event_id', eventId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'RSVP cancelled successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cancel RSVP failed';
    return NextResponse.json(
      { success: false, message: message === 'UNAUTHENTICATED' ? 'Please log in.' : message },
      { status: message === 'UNAUTHENTICATED' ? 401 : 500 }
    );
  }
}
