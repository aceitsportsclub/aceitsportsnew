import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  assertCanManageClub,
  getAuthUserAndProfile,
  isUuid
} from '../application-utils';

export async function DELETE(
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
      .select('id, club_id')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return NextResponse.json({ success: true, message: 'Application already removed.' });
    }

    assertCanManageClub(profile, existing.club_id);

    const { error: deleteError } = await supabase
      .from('applications')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Application deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete application.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
