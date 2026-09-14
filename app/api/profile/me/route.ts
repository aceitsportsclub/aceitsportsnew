import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import { createAdminSupabaseClient, getAuthUserAndProfile, nullable, toSourceUser } from '../../users/user-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user: authUser, profile: authProfile, supabase } = await getAuthUserAndProfile(serverClient, request);

    // Fetch full profile row
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileErr || !profileRow) {
      return NextResponse.json({ success: false, authenticated: false, message: 'Profile not found.' }, { status: 404 });
    }

    // Fetch role & memberships for club slugs
    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      supabase.from('user_roles').select('roles(name, permissions)').eq('user_id', authUser.id),
      supabase.from('club_memberships').select('clubs(slug), roles(name, permissions)').eq('user_id', authUser.id)
    ]);

    const activeRoleName = (userRoles?.[0]?.roles as unknown as { name?: string })?.name || authProfile.role || 'STUDENT';
    const clubSlugs: string[] = [];
    (memberships ?? []).forEach((m) => {
      const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as Record<string, unknown> | null);
      const cSlug = (cObj?.slug as string) || '';
      if (cSlug && !clubSlugs.includes(cSlug)) clubSlugs.push(cSlug);
    });

    const perms = activeRoleName === 'OWNER' ? ['*'] : authProfile.permissions || ['profile.view', 'profile.edit', 'clubs.join'];
    const sourceUser = toSourceUser(profileRow, activeRoleName, clubSlugs, perms);

    return NextResponse.json({
      success: true,
      authenticated: true,
      profile: sourceUser,
      user: sourceUser
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load profile.';
    const status = message === 'UNAUTHENTICATED' ? 401 : 500;
    return NextResponse.json({ success: false, authenticated: false, message }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user: authUser, profile: authProfile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ success: false, message: 'Full name is required.' }, { status: 400 });
    }

    // Build update payload for self-profile
    const profileUpdate: Record<string, unknown> = {
      name,
      updated_at: new Date().toISOString()
    };

    const adminClient = createAdminSupabaseClient();

    if (body.sport !== undefined) profileUpdate.sport = nullable(body.sport);
    if (body.branch !== undefined) profileUpdate.branch = nullable(body.branch);
    if (body.year !== undefined) profileUpdate.year = nullable(body.year);
    if (body.position !== undefined) profileUpdate.position = nullable(body.position);
    if (body.jerseyNo !== undefined) profileUpdate.jersey_no = nullable(body.jerseyNo);
    if (body.height !== undefined) profileUpdate.height = nullable(body.height);
    if (body.mobile !== undefined) profileUpdate.mobile = nullable(body.mobile);
    if (body.bio !== undefined) profileUpdate.bio = nullable(body.bio);

    if (body.photo !== undefined) {
      const rawPhoto = nullable(body.photo);
      if (rawPhoto && rawPhoto.startsWith('data:image/')) {
        try {
          const match = rawPhoto.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const buffer = Buffer.from(match[2], 'base64');
            const fileName = `student-${authUser.id}-${Date.now()}.${ext}`;
            const uploadRes = await adminClient.storage
              .from('player-photos')
              .upload(`students/${fileName}`, buffer, {
                contentType: `image/${match[1]}`,
                upsert: true
              });
            if (!uploadRes.error) {
              const { data: publicUrlData } = adminClient.storage
                .from('player-photos')
                .getPublicUrl(`students/${fileName}`);
              profileUpdate.photo = publicUrlData.publicUrl;
            } else {
              profileUpdate.photo = rawPhoto;
            }
          } else {
            profileUpdate.photo = rawPhoto;
          }
        } catch {
          profileUpdate.photo = rawPhoto;
        }
      } else {
        profileUpdate.photo = rawPhoto; // can be null if user removed photo
      }
    }

    const { data: updatedProfile, error: updateErr } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', authUser.id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    // Sync auth user metadata as well
    try {
      await adminClient.auth.admin.updateUserById(authUser.id, {
        user_metadata: {
          ...(authUser.user_metadata || {}),
          name,
          photo: profileUpdate.photo !== undefined ? profileUpdate.photo : authUser.user_metadata?.photo
        }
      });
    } catch {
      // ignore metadata sync error
    }

    // Fetch user roles and club memberships to return complete updated profile
    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      supabase.from('user_roles').select('roles(name, permissions)').eq('user_id', authUser.id),
      supabase.from('club_memberships').select('clubs(slug), roles(name, permissions)').eq('user_id', authUser.id)
    ]);

    const activeRoleName = (userRoles?.[0]?.roles as unknown as { name?: string })?.name || authProfile.role || 'STUDENT';
    const clubSlugs: string[] = [];
    (memberships ?? []).forEach((m) => {
      const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as Record<string, unknown> | null);
      const cSlug = (cObj?.slug as string) || '';
      if (cSlug && !clubSlugs.includes(cSlug)) clubSlugs.push(cSlug);
    });

    const perms = activeRoleName === 'OWNER' ? ['*'] : authProfile.permissions || ['profile.view', 'profile.edit', 'clubs.join'];
    const sourceUser = toSourceUser(updatedProfile, activeRoleName, clubSlugs, perms);

    return NextResponse.json({
      success: true,
      profile: sourceUser,
      user: sourceUser
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile.';
    const status = message === 'UNAUTHENTICATED' ? 401 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
