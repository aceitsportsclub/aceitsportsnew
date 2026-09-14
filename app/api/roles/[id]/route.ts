import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import {
  assertCanManageRoles,
  getAuthUserAndProfile,
  isUuid,
  toSourceRole,
  VALID_PERMISSIONS
} from '../role-utils';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageRoles(currentProfile);

    const isCallerOwner = currentProfile.role === 'OWNER';

    // 1. Fetch target role
    let query = supabase.from('roles').select('*');
    if (isUuid(id)) {
      query = query.eq('id', id);
    } else {
      query = query.ilike('name', id);
    }

    const { data: targetRole, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !targetRole) {
      // Check if it's protected OWNER
      if (id.toUpperCase() === 'OWNER' && !isCallerOwner) {
        return NextResponse.json({ success: false, message: 'The OWNER role is protected and cannot be modified.' }, { status: 403 });
      }
      return NextResponse.json({ success: false, message: 'Role not found.' }, { status: 404 });
    }

    const currentRoleName = String(targetRole.name || '').toUpperCase().trim();

    // Security: OWNER role is strictly protected against non-owners
    if (currentRoleName === 'OWNER' && !isCallerOwner) {
      return NextResponse.json({ success: false, message: 'The OWNER role is protected and cannot be modified.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const rawName = body.name ? String(body.name).toUpperCase().trim().replace(/[^A-Z0-9_]/g, '') : currentRoleName;
    const title = body.title ? String(body.title).trim() : String(targetRole.title || currentRoleName);
    const description = body.description !== undefined ? String(body.description).trim() : (targetRole.description || '');
    const badgeBg = body.badgeBg || targetRole.badge_bg || '#8E44AD';
    const badgeText = body.badgeText || targetRole.badge_text || '#FFFFFF';
    const badgeGlow = body.badgeGlow || targetRole.badge_glow || 'rgba(142, 68, 173, 0.85)';

    if (!title) {
      return NextResponse.json({ success: false, message: 'Display Title cannot be empty.' }, { status: 400 });
    }

    // Role Security: Cannot rename a role to OWNER
    if (rawName === 'OWNER' && currentRoleName !== 'OWNER') {
      return NextResponse.json({ success: false, message: 'Cannot convert a custom role to OWNER.' }, { status: 403 });
    }

    // System roles (e.g. STUDENT) cannot have their identifier renamed
    const isSystem = Boolean(targetRole.is_system || currentRoleName === 'STUDENT');
    const finalName = isSystem ? currentRoleName : rawName;

    // Check uniqueness if name changed
    if (finalName !== currentRoleName) {
      const { data: duplicate } = await supabase
        .from('roles')
        .select('id')
        .ilike('name', finalName)
        .neq('id', targetRole.id)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json({ success: false, message: `A role with identifier '${finalName}' already exists.` }, { status: 400 });
      }
    }

    // Permissions validation
    let permissions: string[] = Array.isArray(body.permissions)
      ? body.permissions.filter((p: unknown) => typeof p === 'string' && VALID_PERMISSIONS.includes(p))
      : (Array.isArray(targetRole.permissions) ? targetRole.permissions : ['profile.view', 'profile.edit', 'clubs.join']);

    // Non-owners cannot grant '*' full superadmin permissions
    if (permissions.includes('*') && !isCallerOwner) {
      return NextResponse.json({ success: false, message: 'Only an OWNER can grant superadmin permissions (*).' }, { status: 403 });
    }

    const updatePayload = {
      name: finalName,
      title,
      description: description || null,
      badge_bg: badgeBg,
      badge_text: badgeText,
      badge_glow: badgeGlow,
      permissions,
      updated_at: new Date().toISOString()
    };

    const { data: updatedRole, error: updateErr } = await supabase
      .from('roles')
      .update(updatePayload)
      .eq('id', targetRole.id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    return NextResponse.json({
      success: true,
      role: toSourceRole(updatedRole)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update role.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);
    assertCanManageRoles(currentProfile);

    // 1. Fetch target role
    let query = supabase.from('roles').select('*');
    if (isUuid(id)) {
      query = query.eq('id', id);
    } else {
      query = query.ilike('name', id);
    }

    const { data: targetRole, error: fetchErr } = await query.maybeSingle();

    if (fetchErr || !targetRole) {
      if (id.toUpperCase() === 'OWNER') {
        return NextResponse.json({ success: false, message: 'The OWNER role cannot be deleted.' }, { status: 403 });
      }
      return NextResponse.json({ success: false, message: 'Role not found.' }, { status: 404 });
    }

    const roleName = String(targetRole.name || '').toUpperCase().trim();

    // Security: Never delete OWNER or system roles
    if (roleName === 'OWNER') {
      return NextResponse.json({ success: false, message: 'The OWNER role cannot be deleted.' }, { status: 403 });
    }

    if (roleName === 'STUDENT' || targetRole.is_system) {
      return NextResponse.json({ success: false, message: 'Protected system roles cannot be deleted.' }, { status: 403 });
    }

    // 2. Safely handle users currently assigned to this role (revert to STUDENT)
    const { data: studentRole } = await supabase
      .from('roles')
      .select('id')
      .ilike('name', 'STUDENT')
      .maybeSingle();

    const fallbackRoleId = studentRole?.id;

    if (fallbackRoleId) {
      // Reassign users in user_roles
      await supabase
        .from('user_roles')
        .update({ role_id: fallbackRoleId })
        .eq('role_id', targetRole.id);

      // Reassign memberships in club_memberships
      await supabase
        .from('club_memberships')
        .update({ role_id: fallbackRoleId })
        .eq('role_id', targetRole.id);
    } else {
      // If student role row not found, delete referencing user_roles rows to prevent restrict errors
      await supabase
        .from('user_roles')
        .delete()
        .eq('role_id', targetRole.id);
    }

    // 3. Delete custom role from roles table
    const { error: deleteErr } = await supabase
      .from('roles')
      .delete()
      .eq('id', targetRole.id);

    if (deleteErr) {
      throw deleteErr;
    }

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete role.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
