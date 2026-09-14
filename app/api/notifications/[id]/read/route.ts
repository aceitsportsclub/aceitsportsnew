import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  isUuid
} from '../../notification-utils';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid notification ID.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile } = await getAuthUserAndProfile(serverClient, request);

    const adminClient = createAdminSupabaseClient();
    let query = adminClient
      .from('notifications')
      .update({ read: true })
      .eq('id', id);

    if (profile.role !== 'OWNER') {
      query = query.eq('user_id', user.id);
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to mark notification as read.';
    const status = message === 'UNAUTHENTICATED' ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
