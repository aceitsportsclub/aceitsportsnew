import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import {
  assertCanManageUsers,
  createAdminSupabaseClient,
  createStandaloneSupabaseClient,
  getAuthUserAndProfile,
  nullable,
  resolveClub,
  toSourceUser
} from './user-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageUsers(currentProfile);

    const isOwner = currentProfile.role === 'OWNER';

    // 1. Fetch relevant profiles
    let profilesQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (!isOwner) {
      if (!currentProfile.clubs || currentProfile.clubs.length === 0) {
        return NextResponse.json({ success: true, users: [] });
      }
      // club_memberships.club_id is UUID — filter out slug strings to prevent Postgres cast errors
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const clubUuids = currentProfile.clubs.filter((c) => UUID_RE.test(c));
      if (clubUuids.length === 0) {
        return NextResponse.json({ success: true, users: [] });
      }
      const { data: memberRows, error: memberErr } = await supabase
        .from('club_memberships')
        .select('user_id')
        .in('club_id', clubUuids);

      if (memberErr) throw memberErr;
      const allowedUserIds = [...new Set((memberRows ?? []).map((m) => m.user_id))];
      if (allowedUserIds.length === 0) {
        return NextResponse.json({ success: true, users: [] });
      }
      profilesQuery = profilesQuery.in('id', allowedUserIds);
    }

    const { data: profiles, error: profilesErr } = await profilesQuery;
    if (profilesErr) throw profilesErr;

    const profileList = profiles ?? [];
    if (profileList.length === 0) {
      return NextResponse.json({ success: true, users: [] });
    }

    const userIds = profileList.map((p) => p.id);

    // 2. Fetch user_roles and club_memberships for these users
    const [{ data: userRoles }, { data: memberships }] = await Promise.all([
      supabase.from('user_roles').select('user_id, role_id, roles(id, name, permissions)').in('user_id', userIds),
      supabase.from('club_memberships').select('user_id, club_id, active, custom_permissions, roles(id, name, permissions), clubs(id, slug, name)').in('user_id', userIds)
    ]);

    // Build lookup maps
    const rolesMap = new Map<string, string>();
    const permissionsMap = new Map<string, string[]>();
    const clubsMap = new Map<string, string[]>();

    (userRoles ?? []).forEach((ur) => {
      const rObj = Array.isArray(ur.roles) ? ur.roles[0] : (ur.roles as Record<string, unknown> | null);
      if (rObj?.name) {
        rolesMap.set(ur.user_id, String(rObj.name));
        if (Array.isArray(rObj.permissions)) {
          permissionsMap.set(ur.user_id, rObj.permissions as string[]);
        }
      }
    });

    const customPermsSet = new Set<string>();

    (memberships ?? []).forEach((m) => {
      const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as Record<string, unknown> | null);
      const cSlug = (cObj?.slug as string) || '';
      if (cSlug) {
        const existingClubs = clubsMap.get(m.user_id) || [];
        if (!existingClubs.includes(cSlug)) existingClubs.push(cSlug);
        clubsMap.set(m.user_id, existingClubs);
      }

      // If membership has custom_permissions, override the generic role permissions!
      if (Array.isArray(m.custom_permissions)) {
        permissionsMap.set(m.user_id, m.custom_permissions as string[]);
        customPermsSet.add(m.user_id);
      }

      // If user doesn't have a global role yet, use club role
      if (!rolesMap.has(m.user_id)) {
        const mRole = Array.isArray(m.roles) ? m.roles[0] : (m.roles as Record<string, unknown> | null);
        if (mRole?.name) {
          rolesMap.set(m.user_id, String(mRole.name));
          if (!customPermsSet.has(m.user_id) && Array.isArray(mRole.permissions)) {
            permissionsMap.set(m.user_id, mRole.permissions as string[]);
          }
        }
      }
    });

    // Check user_metadata for custom permissions if not found in memberships
    try {
      const adminClient = createAdminSupabaseClient();
      const { data: authUsers } = await adminClient.auth.admin.listUsers();
      (authUsers?.users ?? []).forEach((au) => {
        if (!customPermsSet.has(au.id)) {
          if (Array.isArray(au.user_metadata?.permissions)) {
            permissionsMap.set(au.id, au.user_metadata.permissions as string[]);
            customPermsSet.add(au.id);
          } else if (Array.isArray(au.user_metadata?.custom_permissions)) {
            permissionsMap.set(au.id, au.user_metadata.custom_permissions as string[]);
            customPermsSet.add(au.id);
          }
        }
      });
    } catch {
      // ignore
    }

    const users = profileList.map((p) => {
      const roleName = rolesMap.get(p.id) || 'STUDENT';
      const userClubs = clubsMap.get(p.id) || [];
      const userPerms = roleName === 'OWNER' ? ['*'] : (permissionsMap.has(p.id) ? permissionsMap.get(p.id)! : ['profile.view', 'profile.edit', 'clubs.join']);
      return toSourceUser(p, roleName, userClubs, userPerms);
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load users.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ success: false, users: [], message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageUsers(currentProfile);

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !username) {
      return NextResponse.json({ success: false, message: 'Name and Username are required fields.' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters long.' }, { status: 400 });
    }

    // Role Security: Non-OWNER users can never create or assign an OWNER role
    const requestedRole = String(body.role || 'STUDENT').toUpperCase().trim();
    if (requestedRole === 'OWNER' && currentProfile.role !== 'OWNER') {
      return NextResponse.json({ success: false, message: 'Non-owner admins cannot assign the OWNER role.' }, { status: 403 });
    }

    // Determine target clubs — accept single `club` string OR `clubs` array
    const rawClubs = Array.isArray(body.clubs)
      ? body.clubs
      : (typeof body.club === 'string' && body.club.trim() ? [body.club.trim()] : []);
    const requestedClubs: string[] = rawClubs.filter((c: unknown) => typeof c === 'string' && c.trim());
    const resolvedClubIds: { id: string; slug: string }[] = [];

    for (const cRef of requestedClubs) {
      try {
        const resolved = await resolveClub(supabase, cRef);
        // Non-OWNER can only assign clubs they are authorized to manage
        if (currentProfile.role !== 'OWNER' && !currentProfile.clubs.includes(resolved.id)) {
          return NextResponse.json({ success: false, message: `You are not authorized to assign users to club: ${cRef}` }, { status: 403 });
        }
        resolvedClubIds.push({ id: resolved.id, slug: resolved.slug });
      } catch {
        // Skip invalid club references
      }
    }

    if (currentProfile.role !== 'OWNER' && resolvedClubIds.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one valid club authorized to you must be assigned.' }, { status: 400 });
    }

    // Check if username already exists in profiles
    const { data: existingUser } = await supabase.from('profiles').select('id').ilike('username', username).maybeSingle();
    if (existingUser) {
      return NextResponse.json({ success: false, message: 'Username is already taken. Please choose another.' }, { status: 400 });
    }

    // Determine email
    let email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) {
      email = `${username.replace(/[^a-z0-9]/g, '')}@aceit.edu.in`;
    }

    // 1. Create auth credentials in Supabase Auth using Admin API (service role)
    const userPerms = requestedRole === 'OWNER' ? ['*'] : (Array.isArray(body.permissions) ? body.permissions : (requestedRole === 'STUDENT' ? ['profile.view', 'profile.edit', 'clubs.join'] : []));

    const adminClient = createAdminSupabaseClient();
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        role: requestedRole,
        permissions: userPerms,
        custom_permissions: userPerms
      }
    });

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, message: authError?.message || 'Failed to create user credentials.' }, { status: 400 });
    }

    const newUserId = authData.user.id;

    // 2. Insert into profiles table
    const profilePayload = {
      id: newUserId,
      name,
      username,
      email,
      rtu_roll_no: nullable(body.rtuRollNo),
      branch: nullable(body.branch),
      year: nullable(body.year),
      position: nullable(body.position),
      jersey_no: nullable(body.jerseyNo),
      height: nullable(body.height),
      mobile: nullable(body.mobile),
      sport: nullable(body.sport),
      photo: nullable(body.photo),
      bio: nullable(body.bio),
      active: body.active !== false
    };

    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .upsert(profilePayload)
      .select()
      .single();

    if (profileError) {
      throw profileError;
    }

    // 3. Assign Role & Memberships
    const { data: roleRow } = await supabase.from('roles').select('id, name, permissions').ilike('name', requestedRole).maybeSingle();

    if (roleRow) {
      // If OWNER, assign to user_roles
      if (requestedRole === 'OWNER') {
        await supabase.from('user_roles').upsert({ user_id: newUserId, role_id: roleRow.id });
      } else {
        await supabase.from('user_roles').upsert({ user_id: newUserId, role_id: roleRow.id });
      }

      // Assign club memberships
      for (const c of resolvedClubIds) {
        await supabase.from('club_memberships').upsert({
          user_id: newUserId,
          club_id: c.id,
          role_id: roleRow.id,
          active: body.active !== false,
          custom_permissions: userPerms
        });
      }
    }

    const clubSlugs = resolvedClubIds.map((c) => c.slug);
    const createdUser = toSourceUser(profileRow, requestedRole, clubSlugs, userPerms);

    return NextResponse.json({ success: true, user: createdUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create user.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
