import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../../lib/supabase/auth-server';
import {
  assertCanManageClub,
  getAuthUserAndProfile,
  isUuid,
  toSourceApplication
} from '../../application-utils';

const VALID_STATUSES = ['Pending', 'Reviewed', 'Accepted', 'Rejected'] as const;

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id || !isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid application ID.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const { data: existing, error: findError } = await supabase
      .from('applications')
      .select('id, club_id, status')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ success: false, message: 'Application not found.' }, { status: 404 });
    }

    assertCanManageClub(profile, existing.club_id);

    const body = await request.json().catch(() => ({}));
    const newStatus = typeof body.status === 'string' ? body.status.trim() : '';

    if (!VALID_STATUSES.includes(newStatus as any)) {
      return NextResponse.json(
        { success: false, message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('applications')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, clubs(id, slug, name)')
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      application: toSourceApplication(updated)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update application status.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
