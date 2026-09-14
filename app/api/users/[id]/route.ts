import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  assertCanManageUsers,
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  isUuid,
  nullable,
  resolveClub,
  toSourceUser
} from '../user-utils';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID format.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { user: authUser, profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageUsers(currentProfile);

    const isCallerOwner = currentProfile.role === 'OWNER';
    const isSelf = id === authUser.id || id === currentProfile.id;

    // 1. Fetch existing user profile and roles
    const { data: targetProfile, error: targetProfileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (targetProfileErr || !targetProfile) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const { data: targetUserRoles } = await supabase
      .from('user_roles')
      .select('role_id, roles(id, name, permissions)')
      .eq('user_id', id);

    let targetCurrentRole = 'STUDENT';
    (targetUserRoles ?? []).forEach((ur) => {
      const rObj = Array.isArray(ur.roles) ? ur.roles[0] : (ur.roles as Record<string, unknown> | null);
      if (rObj?.name) {
        targetCurrentRole = String(rObj.name);
      }
    });

    // Security: Non-owners cannot edit OWNER accounts
    if (targetCurrentRole === 'OWNER' && !isCallerOwner) {
      return NextResponse.json({ success: false, message: 'Only an OWNER can modify an OWNER account.' }, { status: 403 });
    }

    // Scoping for non-owner: target user must be within caller's managed clubs
    if (!isCallerOwner) {
      const { data: targetMemberships } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', id);

      const targetClubIds = (targetMemberships ?? []).map((m) => m.club_id);
      const hasSharedClub = targetClubIds.some((cid) => currentProfile.clubs.includes(cid));

      if (!hasSharedClub && !isSelf) {
        return NextResponse.json({ success: false, message: 'You are not authorized to edit this user.' }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || targetProfile.name || '').trim();

    if (!name) {
      return NextResponse.json({ success: false, message: 'Full name is required.' }, { status: 400 });
    }

    // Role Security: Non-owners cannot assign OWNER role
    const requestedRole = body.role ? String(body.role).toUpperCase().trim() : targetCurrentRole;
    if (requestedRole === 'OWNER' && !isCallerOwner) {
      return NextResponse.json({ success: false, message: 'Non-owner admins cannot assign the OWNER role.' }, { status: 403 });
    }

    // Non-owners editing themselves cannot elevate their own role or perms
    const finalRole = (isSelf && !isCallerOwner) ? targetCurrentRole : requestedRole;

    // 2. Update profiles table
    const profileUpdate: Record<string, unknown> = {
      name,
      rtu_roll_no: body.rtuRollNo !== undefined ? nullable(body.rtuRollNo) : targetProfile.rtu_roll_no,
      branch: body.branch !== undefined ? nullable(body.branch) : targetProfile.branch,
      year: body.year !== undefined ? nullable(body.year) : targetProfile.year,
      position: body.position !== undefined ? nullable(body.position) : targetProfile.position,
      jersey_no: body.jerseyNo !== undefined ? nullable(body.jerseyNo) : targetProfile.jersey_no,
      height: body.height !== undefined ? nullable(body.height) : targetProfile.height,
      mobile: body.mobile !== undefined ? nullable(body.mobile) : targetProfile.mobile,
      sport: body.sport !== undefined ? nullable(body.sport) : targetProfile.sport,
      photo: body.photo !== undefined ? nullable(body.photo) : targetProfile.photo,
      bio: body.bio !== undefined ? nullable(body.bio) : targetProfile.bio
    };

    if (typeof body.username === 'string' && body.username.trim()) {
      const cleanUsername = body.username.trim();
      // Allow username edit if caller is owner or username is unchanged
      if (cleanUsername !== targetProfile.username) {
        if (!isCallerOwner) {
          return NextResponse.json({ success: false, message: 'Only an OWNER can change usernames.' }, { status: 403 });
        }
        // Check uniqueness
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', cleanUsername)
          .neq('id', id)
          .maybeSingle();

        if (existingUser) {
          return NextResponse.json({ success: false, message: `Username '${cleanUsername}' is already taken.` }, { status: 400 });
        }
        profileUpdate.username = cleanUsername;
      }
    }

    if (typeof body.email === 'string' && body.email.trim()) {
      profileUpdate.email = body.email.trim().toLowerCase();
    }

    // Only allow updating active state if caller is not self or is owner
    if (body.active !== undefined && (!isSelf || isCallerOwner)) {
      profileUpdate.active = Boolean(body.active);
    }

    const { data: updatedProfile, error: profileErr } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', id)
      .select()
      .single();

    if (profileErr) {
      throw profileErr;
    }

    // 3. Optional Password & Email Update via Admin Client
    const authUpdates: { password?: string; email?: string } = {};
    if (typeof body.password === 'string' && body.password.trim().length >= 6) {
      authUpdates.password = body.password.trim();
    }
    if (profileUpdate.email && typeof profileUpdate.email === 'string' && profileUpdate.email !== targetProfile.email) {
      authUpdates.email = profileUpdate.email;
    }

    if (Object.keys(authUpdates).length > 0) {
      try {
        const adminClient = createAdminSupabaseClient();
        if (adminClient.auth.admin) {
          await adminClient.auth.admin.updateUserById(id, authUpdates);
        }
      } catch (authErr) {
        console.warn('Unable to update user auth directly via auth admin:', authErr);
      }
    }

    // 4. Update Role if permitted
    if (!isSelf || isCallerOwner) {
      const { data: roleRow } = await supabase
        .from('roles')
        .select('id, name, permissions')
        .ilike('name', finalRole)
        .maybeSingle();

      if (roleRow) {
        await supabase
          .from('user_roles')
          .upsert({ user_id: id, role_id: roleRow.id });
      }
    }

    // 5. Update Club Memberships and Permissions if provided and allowed
    const permissionsProvided = Array.isArray(body.permissions) && (!isSelf || isCallerOwner);
    const clubsRaw = Array.isArray(body.clubs)
      ? body.clubs
      : (typeof body.club === 'string' && body.club.trim() ? [body.club.trim()] : null);
    const clubsProvided = clubsRaw !== null && (!isSelf || isCallerOwner);

    if (permissionsProvided || clubsProvided) {
      const adminClient = createAdminSupabaseClient();

      // If permissions are provided, persist them in Supabase Auth user_metadata
      if (permissionsProvided) {
        try {
          const { data: currentAuthUser } = await adminClient.auth.admin.getUserById(id);
          const currentMeta = currentAuthUser?.user?.user_metadata || {};
          await adminClient.auth.admin.updateUserById(id, {
            user_metadata: {
              ...currentMeta,
              permissions: body.permissions,
              custom_permissions: body.permissions
            }
          });
        } catch (metaErr) {
          console.warn('Unable to update user_metadata permissions:', metaErr);
        }
      }

      if (clubsProvided) {
        const resolvedClubIds: { id: string; slug: string }[] = [];
        for (const cRef of (clubsRaw as string[])) {
          try {
            const resolved = await resolveClub(supabase, cRef);
            if (!isCallerOwner && !currentProfile.clubs.includes(resolved.id)) {
              // Non-owner cannot assign clubs they don't manage
              continue;
            }
            resolvedClubIds.push({ id: resolved.id, slug: resolved.slug });
          } catch {
            // ignore unresolvable
          }
        }

        // Fetch role id to associate with membership
        const { data: currentRoleData } = await supabase
          .from('roles')
          .select('id')
          .ilike('name', finalRole)
          .maybeSingle();

        const roleIdForMembership = currentRoleData?.id;

        // If permissions are not provided in this call, retain existing custom_permissions from membership
        let permissionsToStore = permissionsProvided ? body.permissions : undefined;
        if (permissionsToStore === undefined) {
          const { data: existingMems } = await supabase
            .from('club_memberships')
            .select('custom_permissions')
            .eq('user_id', id);
          const found = existingMems?.map((m) => m.custom_permissions).find((cp) => Array.isArray(cp));
          permissionsToStore = Array.isArray(found) ? found : [];
        }

        if (isCallerOwner) {
          // Replace all club memberships
          await supabase.from('club_memberships').delete().eq('user_id', id);
          for (const c of resolvedClubIds) {
            await supabase.from('club_memberships').insert({
              user_id: id,
              club_id: c.id,
              role_id: roleIdForMembership,
              active: profileUpdate.active !== false,
              custom_permissions: permissionsToStore
            });
          }
        } else {
          // Club admin: only sync within clubs they manage
          for (const managedClubId of currentProfile.clubs) {
            const shouldHave = resolvedClubIds.some((c) => c.id === managedClubId);
            if (shouldHave) {
              await supabase.from('club_memberships').upsert({
                user_id: id,
                club_id: managedClubId,
                role_id: roleIdForMembership,
                active: profileUpdate.active !== false,
                custom_permissions: permissionsToStore
              });
            } else {
              await supabase.from('club_memberships').delete().match({
                user_id: id,
                club_id: managedClubId
              });
            }
          }
        }
      } else if (permissionsProvided) {
        // Clubs were not provided, but permissions were: update all memberships for this user
        await supabase
          .from('club_memberships')
          .update({ custom_permissions: body.permissions })
          .eq('user_id', id);
      }
    }

    // 6. Return refreshed source user
    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      supabase.from('user_roles').select('roles(name, permissions)').eq('user_id', id),
      supabase.from('club_memberships').select('clubs(slug), roles(name, permissions), custom_permissions').eq('user_id', id)
    ]);

    const activeRoleName = (userRoles?.[0]?.roles as unknown as { name?: string })?.name || finalRole;
    const clubSlugs: string[] = [];
    (memberships ?? []).forEach((m) => {
      const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as Record<string, unknown> | null);
      const cSlug = (cObj?.slug as string) || '';
      if (cSlug && !clubSlugs.includes(cSlug)) clubSlugs.push(cSlug);
    });

    let perms: string[];
    if (activeRoleName === 'OWNER') {
      perms = ['*'];
    } else if (permissionsProvided) {
      perms = body.permissions;
    } else {
      const memPerms = memberships?.map((m) => m.custom_permissions).find((cp) => Array.isArray(cp));
      perms = Array.isArray(memPerms) ? memPerms : ((userRoles?.[0]?.roles as unknown as { permissions?: string[] })?.permissions || ['profile.view', 'profile.edit', 'clubs.join']);
    }

    const sourceUser = toSourceUser(updatedProfile, activeRoleName, clubSlugs, perms);

    return NextResponse.json({ success: true, user: sourceUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update user.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ success: false, message: 'Invalid user ID format.' }, { status: 400 });
    }

    const serverClient = await createSupabaseAuthServerClient();
    const { user: authUser, profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageUsers(currentProfile);

    // Prevent deleting own active account
    if (id === authUser.id || id === currentProfile.id) {
      return NextResponse.json({ success: false, message: 'You cannot delete your own account.' }, { status: 400 });
    }

    // 1. Fetch target user's role and memberships
    const [{ data: targetProfile }, { data: targetUserRoles }, { data: targetMemberships }] = await Promise.all([
      supabase.from('profiles').select('id').eq('id', id).maybeSingle(),
      supabase.from('user_roles').select('roles(name)').eq('user_id', id),
      supabase.from('club_memberships').select('club_id').eq('user_id', id)
    ]);

    if (!targetProfile) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    let isTargetOwner = false;
    (targetUserRoles ?? []).forEach((ur) => {
      const rObj = Array.isArray(ur.roles) ? ur.roles[0] : (ur.roles as Record<string, unknown> | null);
      if (rObj?.name === 'OWNER') {
        isTargetOwner = true;
      }
    });

    // Never allow deleting an OWNER account
    if (isTargetOwner) {
      return NextResponse.json({ success: false, message: 'OWNER accounts cannot be deleted.' }, { status: 403 });
    }

    // Non-owner checks: target user must belong to caller's clubs
    const isCallerOwner = currentProfile.role === 'OWNER';
    if (!isCallerOwner) {
      const targetClubIds = (targetMemberships ?? []).map((m) => m.club_id);
      const isMemberOfCallerClub = targetClubIds.some((cid) => currentProfile.clubs.includes(cid));

      if (!isMemberOfCallerClub) {
        return NextResponse.json({ success: false, message: 'You are not authorized to delete this user.' }, { status: 403 });
      }
    }

    // 2. Safely delete memberships, user_roles, and profile
    await supabase.from('club_memberships').delete().eq('user_id', id);
    await supabase.from('user_roles').delete().eq('user_id', id);
    const { error: profileDelErr } = await supabase.from('profiles').delete().eq('id', id);

    if (profileDelErr) {
      throw profileDelErr;
    }

    // 3. Delete from Supabase Auth if admin service client is available
    try {
      const adminClient = createAdminSupabaseClient();
      if (adminClient.auth.admin) {
        await adminClient.auth.admin.deleteUser(id);
      }
    } catch (authDelErr) {
      console.warn('Unable to delete auth user record via service client:', authDelErr);
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete user.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}
