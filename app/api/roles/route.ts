import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import {
  assertCanManageRoles,
  getAuthUserAndProfile,
  SEEDED_ROLES,
  toSourceRole,
  VALID_PERMISSIONS
} from './role-utils';

export async function GET() {
  try {
    const supabase = await createSupabaseAuthServerClient();
    const { data: dbRoles, error } = await supabase.from('roles').select('*').order('name');

    if (error) {
      console.warn('Unable to query roles table, falling back to base seeded roles:', error.message);
    }

    const rolesMap = new Map<string, Record<string, unknown>>();

    // 1. Seed base system roles first
    SEEDED_ROLES.forEach((sr) => {
      rolesMap.set(sr.name.toUpperCase(), sr);
    });

    // 2. Overlay / append stored roles from database
    (dbRoles ?? []).forEach((r) => {
      const rName = String(r.name || '').toUpperCase().trim();
      if (rName) {
        rolesMap.set(rName, r);
      }
    });

    const roles = Array.from(rolesMap.values()).map(toSourceRole);

    return NextResponse.json(
      {
        success: true,
        roles
      },
      {
        headers: {
          'CDN-Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
          'Vary': 'Accept-Encoding'
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error fetching roles';
    return NextResponse.json({ success: false, roles: SEEDED_ROLES.map(toSourceRole), message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageRoles(currentProfile);

    const isCallerOwner = currentProfile.role === 'OWNER';

    const body = await request.json().catch(() => ({}));
    const rawName = String(body.name || '').toUpperCase().trim().replace(/[^A-Z0-9_]/g, '');
    const title = String(body.title || '').trim();
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const badgeBg = typeof body.badgeBg === 'string' && body.badgeBg.trim() ? body.badgeBg.trim() : '#8E44AD';
    const badgeText = typeof body.badgeText === 'string' && body.badgeText.trim() ? body.badgeText.trim() : '#FFFFFF';
    const badgeGlow = typeof body.badgeGlow === 'string' && body.badgeGlow.trim() ? body.badgeGlow.trim() : 'rgba(142, 68, 173, 0.85)';

    if (!rawName || !title) {
      return NextResponse.json({ success: false, message: 'Role Identifier and Display Title are required.' }, { status: 400 });
    }

    // Role Security: Never allow creating an OWNER role
    if (rawName === 'OWNER') {
      return NextResponse.json({ success: false, message: 'Cannot create or duplicate the OWNER role.' }, { status: 403 });
    }

    // Role Security: Non-owners cannot grant '*' full superadmin permissions
    let requestedPerms: string[] = Array.isArray(body.permissions)
      ? body.permissions.filter((p: unknown) => typeof p === 'string' && VALID_PERMISSIONS.includes(p))
      : [];

    if (requestedPerms.includes('*') && !isCallerOwner) {
      return NextResponse.json({ success: false, message: 'Only an OWNER can grant superadmin permissions (*).' }, { status: 403 });
    }

    if (requestedPerms.length === 0) {
      requestedPerms = ['profile.view', 'profile.edit', 'clubs.join'];
    }

    // Check uniqueness
    const { data: existingRole } = await supabase
      .from('roles')
      .select('id, name')
      .ilike('name', rawName)
      .maybeSingle();

    if (existingRole) {
      return NextResponse.json({ success: false, message: `A role with identifier '${rawName}' already exists.` }, { status: 400 });
    }

    // Insert new custom role
    const insertPayload = {
      name: rawName,
      title,
      description: description || null,
      badge_bg: badgeBg,
      badge_text: badgeText,
      badge_glow: badgeGlow,
      permissions: requestedPerms,
      is_system: false
    };

    const { data: createdRole, error: insertError } = await supabase
      .from('roles')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      role: toSourceRole(createdRole)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create role.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
