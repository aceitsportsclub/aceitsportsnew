import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import {
  assertCanManageClub,
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  isUuid,
  nullable,
  resolveClub,
  toSourceAnnouncement
} from './announcement-utils';

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const url = new URL(request.url);
    const clubParam = url.searchParams.get('clubId')?.trim();
    const categoryParam = url.searchParams.get('category')?.trim();

    let query = supabase
      .from('announcements')
      .select('*, clubs(id, slug, name)');

    if (clubParam && clubParam.toLowerCase() !== 'all') {
      const resolved = await resolveClub(supabase, clubParam);
      query = query.eq('club_id', resolved.id);
    }

    if (categoryParam && categoryParam.toLowerCase() !== 'all') {
      query = query.ilike('category', categoryParam);
    }

    query = query
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const userIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
    const profileMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      if (profiles) {
        profiles.forEach((p) => {
          if (p.id && p.name) profileMap.set(p.id, p.name);
        });
      }
    }

    const announcements = rows.map((row) => toSourceAnnouncement(row, profileMap));
    return NextResponse.json({ success: true, announcements });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        announcements: [],
        message: error instanceof Error ? error.message : 'Unable to load announcements.'
      },
      { status: 200 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const body = await request.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: 'Notice Title and Content are required.' },
        { status: 400 }
      );
    }

    const clubRef = String(body.club || body.clubId || body.club_id || '');
    const club = await resolveClub(supabase, clubRef);
    assertCanManageClub(profile, club.id);

    const category = nullable(body.category);
    const isPinned = Boolean(body.isPinned ?? body.is_pinned ?? false);

    // Use admin client for INSERT to bypass RLS — auth + club permission already verified above
    const insertClient = createAdminSupabaseClient();
    const { data, error } = await insertClient
      .from('announcements')
      .insert({
        club_id: club.id,
        title,
        category,
        content,
        is_pinned: isPinned,
        created_by: user.id
      })
      .select('*, clubs(id, slug, name)')
      .single();

    if (error) throw error;

    // Send in-app notifications if requested (default true)
    const sendBroadcast = body.sendBroadcast !== false;
    if (sendBroadcast) {
      try {
        const adminClient = createAdminSupabaseClient();
        const [{ data: members }, { data: ownerRoles }, { data: clubDetail }] = await Promise.all([
          adminClient
            .from('club_memberships')
            .select('user_id')
            .eq('club_id', club.id)
            .eq('active', true),
          adminClient
            .from('roles')
            .select('id')
            .eq('name', 'OWNER')
            .maybeSingle(),
          adminClient
            .from('clubs')
            .select('sport')
            .eq('id', club.id)
            .maybeSingle()
        ]);

        let ownerUserIds: string[] = [];
        if (ownerRoles?.id) {
          const { data: owners } = await adminClient
            .from('user_roles')
            .select('user_id')
            .eq('role_id', ownerRoles.id);
          if (owners) ownerUserIds = owners.map((o) => o.user_id).filter(Boolean);
        }

        let sportUserIds: string[] = [];
        if (clubDetail?.sport) {
          const { data: sportProfiles } = await adminClient
            .from('profiles')
            .select('id')
            .ilike('sport', `%${clubDetail.sport}%`);
          if (sportProfiles) sportUserIds = sportProfiles.map((p) => p.id).filter(Boolean);
        }

        const recipientIds = new Set<string>([
          user.id,
          ...ownerUserIds,
          ...sportUserIds,
          ...(members ?? []).map((m) => m.user_id).filter(Boolean)
        ]);

        if (recipientIds.size > 0) {
          const notifRows = Array.from(recipientIds).map((recipientId) => ({
            user_id: recipientId,
            club_id: club.id,
            title,
            message: content.length > 120 ? content.slice(0, 117) + '...' : content,
            type: isPinned ? 'urgent' : (category ? category.toLowerCase() : 'announcement'),
            read: false
          }));

          await adminClient.from('notifications').insert(notifRows);
        }
      } catch (notifErr) {
        console.error('[Announcements POST] Notification broadcast error:', notifErr);
      }
    }

    const profileMap = new Map<string, string>();
    if (profile.name) profileMap.set(user.id, profile.name);

    return NextResponse.json({
      success: true,
      announcement: toSourceAnnouncement(data, profileMap)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create announcement.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const id = (url.searchParams.get('id') || body.id || body._id)?.trim();

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

    const updateClient = createAdminSupabaseClient();
    const { data: updated, error: updateError } = await updateClient
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

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const id = (url.searchParams.get('id') || body?.id || body?._id)?.trim();

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

    const deleteClient = createAdminSupabaseClient();
    const { error: deleteError } = await deleteClient
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
