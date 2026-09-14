import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  assertCanManageClub,
  getAuthUserAndProfile,
  isUuid,
  nullable,
  resolveClub,
  toSourceAnnouncement
} from '../announcement-utils';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid announcement ID.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const { data: existing, error: findError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ success: false, message: 'Announcement not found.' }, { status: 404 });
    }

    assertCanManageClub(profile, existing.club_id);

    const body = await request.json().catch(() => ({}));

    let targetClubId = existing.club_id;
    if (body.club || body.clubId || body.club_id) {
      const clubRef = String(body.club || body.clubId || body.club_id);
      if (clubRef !== 'all') {
        const resolved = await resolveClub(supabase, clubRef);
        assertCanManageClub(profile, resolved.id);
        targetClubId = resolved.id;
      }
    }

    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const content = body.content !== undefined ? String(body.content).trim() : existing.content;

    if (!title || !content) {
      return NextResponse.json({ success: false, message: 'Notice Title and Content are required.' }, { status: 400 });
    }

    const category = body.category !== undefined ? nullable(body.category) : existing.category;
    const isPinned = body.isPinned !== undefined
      ? Boolean(body.isPinned)
      : (body.is_pinned !== undefined ? Boolean(body.is_pinned) : existing.is_pinned);

    const { data: updated, error: updateError } = await supabase
      .from('announcements')
      .update({
        club_id: targetClubId,
        title,
        category,
        content,
        is_pinned: isPinned,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, clubs(id, slug, name)')
      .single();

    if (updateError) throw updateError;

    let authorName: string | undefined;
    if (updated.created_by) {
      const { data: authorProfile } = await supabase.from('profiles').select('name').eq('id', updated.created_by).maybeSingle();
      authorName = authorProfile?.name;
    }

    return NextResponse.json({
      success: true,
      announcement: toSourceAnnouncement(updated, authorName && updated.created_by ? new Map([[updated.created_by, authorName]]) : undefined)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update announcement.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || !isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid announcement ID.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const { data: existing, error: findError } = await supabase
      .from('announcements')
      .select('id, club_id')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw findError;

    if (!existing) {
      return NextResponse.json({ success: true, message: 'Announcement already removed.' });
    }

    assertCanManageClub(profile, existing.club_id);

    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete announcement.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
