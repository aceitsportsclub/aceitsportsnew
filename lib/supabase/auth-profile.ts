import type { SupabaseClient, User } from '@supabase/supabase-js';

export type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  email: string | null;
  photo: string | null;
  role: string;
  permissions: string[];
  clubId: string;
  clubs: string[];
};

export async function ensureProfile(supabase: SupabaseClient, user: User, metadata?: Record<string, unknown>) {
  const { data: existing, error: readError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (readError) {
    throw new Error('Unable to load the authenticated user profile.');
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      name: typeof metadata?.name === 'string' ? metadata.name : user.user_metadata?.name ?? null,
      username: typeof metadata?.username === 'string' ? metadata.username : user.user_metadata?.username ?? null,
      email: user.email ?? null,
      rtu_roll_no: typeof metadata?.rtuRollNo === 'string' ? metadata.rtuRollNo : null,
      branch: typeof metadata?.branch === 'string' ? metadata.branch : null,
      year: typeof metadata?.year === 'string' ? metadata.year : null,
      mobile: typeof metadata?.mobile === 'string' ? metadata.mobile : null,
      photo: typeof metadata?.photo === 'string' ? metadata.photo : null
    });

    if (insertError) {
      throw new Error('Unable to create the authenticated user profile.');
    }
  }
}

export async function getAuthProfile(supabase: SupabaseClient, user: User): Promise<Profile> {
  await ensureProfile(supabase, user);

  const [{ data: profile, error: profileError }, { data: roleRows }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('roles(name, permissions)').eq('user_id', user.id),
    supabase.from('club_memberships').select('club_id, custom_permissions, roles(name, permissions), clubs(id, slug, name)').eq('user_id', user.id).eq('active', true)
  ]);

  if (profileError || !profile) {
    throw new Error('Authenticated user profile is unavailable.');
  }

  const globalRoles = (roleRows ?? []).map((row) => (Array.isArray(row.roles) ? row.roles[0] : row.roles)).filter(Boolean);
  const membershipRoles = (memberships ?? []).map((m) => (Array.isArray(m.roles) ? m.roles[0] : (m.roles as Record<string, unknown> | null))).filter(Boolean);

  const isOwner = globalRoles.some((candidate) => candidate.name === 'OWNER') || membershipRoles.some((candidate) => candidate?.name === 'OWNER');
  const primaryRole = globalRoles.find((c) => c.name === 'OWNER') || membershipRoles[0] || globalRoles[0];
  const roleName = isOwner ? 'OWNER' : (primaryRole?.name ?? 'STUDENT');

  const clubSlugs: string[] = [];
  const allClubIdentifiers: string[] = [];

  (memberships ?? []).forEach((m) => {
    const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as Record<string, unknown> | null);
    const slug = (typeof cObj?.slug === 'string' ? cObj.slug : '').toLowerCase().trim();
    const uuid = String(m.club_id || '').toLowerCase().trim();

    if (slug && !clubSlugs.includes(slug)) {
      clubSlugs.push(slug);
    }
    if (slug && !allClubIdentifiers.includes(slug)) {
      allClubIdentifiers.push(slug);
    }
    if (uuid && !allClubIdentifiers.includes(uuid)) {
      allClubIdentifiers.push(uuid);
    }
  });

  let permissions: string[];
  if (roleName === 'OWNER') {
    permissions = ['*'];
  } else {
    // 1. Check custom_permissions on club memberships (explicit array, including [], overrides role)
    const membershipWithExplicitPerms = (memberships ?? []).find(
      (m) => Array.isArray(m.custom_permissions)
    );
    const customFromMembership = membershipWithExplicitPerms
      ? (membershipWithExplicitPerms.custom_permissions as string[])
      : undefined;

    // 2. Check permissions on user_metadata
    const metaPerms = Array.isArray(user.user_metadata?.permissions)
      ? (user.user_metadata.permissions as string[])
      : (Array.isArray(user.user_metadata?.custom_permissions)
      ? (user.user_metadata.custom_permissions as string[])
      : undefined);

    if (Array.isArray(customFromMembership)) {
      permissions = customFromMembership;
    } else if (Array.isArray(metaPerms)) {
      permissions = metaPerms;
    } else if (Array.isArray(primaryRole?.permissions)) {
      permissions = primaryRole.permissions;
    } else if (roleName === 'ADMIN' || roleName === 'ADMINS') {
      permissions = [
        'players.*',
        'matches.*',
        'news.*',
        'gallery.*',
        'training.*',
        'events.*',
        'testimonials.*',
        'sponsors.*',
        'stats.*',
        'about.*',
        'contact.*',
        'slideshow.*',
        'applications.*'
      ];
    } else {
      permissions = ['profile.view', 'profile.edit', 'clubs.join'];
    }
  }

  const primaryClubSlug = clubSlugs[0] || (allClubIdentifiers.find((c) => !/^[0-9a-f]{8}-/i.test(c))) || 'spikers';

  return {
    id: user.id,
    name: profile?.name ?? user.user_metadata?.name ?? user.email ?? '',
    username: profile?.username ?? user.email ?? '',
    email: profile?.email ?? user.email ?? '',
    photo: profile?.photo ?? null,
    role: roleName,
    permissions,
    clubId: roleName === 'OWNER' ? 'ALL' : primaryClubSlug,
    clubs: allClubIdentifiers.length > 0 ? allClubIdentifiers : (roleName === 'OWNER' ? ['ALL'] : ['spikers'])
  };
}
