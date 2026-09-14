import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import { createAdminSupabaseClient, getAuthUserAndProfile } from '../roles/role-utils';

const PIN_SALT = 'aceit_sports_pin_salt_2026';
const DEFAULT_PIN_HASH = crypto.createHash('sha256').update(PIN_SALT + '2026').digest('hex');

function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(PIN_SALT + pin).digest('hex');
}

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile: currentProfile } = await getAuthUserAndProfile(serverClient, request);

    const isOwner = currentProfile.role === 'OWNER';
    const hasPerm = Array.isArray(currentProfile.permissions) && (
      currentProfile.permissions.includes('*') || currentProfile.permissions.includes('settings.*')
    );

    if (!isOwner && !hasPerm) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    // Never return the PIN or hash
    return NextResponse.json({
      success: true,
      hasPin: true,
      message: 'PIN is configured.'
    });
  } catch {
    return NextResponse.json({ success: false, message: 'Unauthenticated' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile: currentProfile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const isOwner = currentProfile.role === 'OWNER';
    const hasPerm = Array.isArray(currentProfile.permissions) && (
      currentProfile.permissions.includes('*') || currentProfile.permissions.includes('settings.*')
    );

    if (!isOwner && !hasPerm) {
      return NextResponse.json({ success: false, message: 'Forbidden. Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'change').toLowerCase().trim();
    const pin = String(body.pin || body.newPin || '').trim();

    if (!pin) {
      return NextResponse.json({ success: false, message: 'PIN is required.' }, { status: 400 });
    }

    const adminClient = createAdminSupabaseClient();

    let currentMetadataHash = user.user_metadata?.admin_pin_hash as string | undefined;
    if (!currentMetadataHash) {
      const { data: userList } = await adminClient.auth.admin.listUsers();
      const ownerUser = (userList?.users || []).find((u) => u.user_metadata?.admin_pin_hash);
      currentMetadataHash = ownerUser?.user_metadata?.admin_pin_hash || DEFAULT_PIN_HASH;
    }

    if (action === 'verify') {
      const inputHash = hashPin(pin);
      const isValid = inputHash === currentMetadataHash;
      return NextResponse.json({
        success: true,
        valid: isValid
      });
    }

    // Action is 'change' or 'update'
    if (!/^\d{4,}$/.test(pin)) {
      return NextResponse.json({
        success: false,
        message: 'PIN must be numbers only and at least 4 digits.'
      }, { status: 400 });
    }

    // If currentPin is required or provided, verify it first
    if (body.currentPin) {
      const curInputHash = hashPin(String(body.currentPin).trim());
      if (curInputHash !== currentMetadataHash) {
        return NextResponse.json({
          success: false,
          message: 'Current PIN is incorrect.'
        }, { status: 403 });
      }
    }

    const newHash = hashPin(pin);

    // Persist hash in user_metadata for this authenticated admin
    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        admin_pin_hash: newHash,
        admin_pin_updated_at: new Date().toISOString()
      }
    });

    if (updateError) {
      throw updateError;
    }

    // If owner or setting admin PIN, also update all other admins' metadata so all authorized admins share the updated PIN
    try {
      const { data: userList } = await adminClient.auth.admin.listUsers();
      for (const u of userList?.users || []) {
        if (u.id !== user.id && (isOwner || u.user_metadata?.admin_pin_hash)) {
          await adminClient.auth.admin.updateUserById(u.id, {
            user_metadata: {
              ...(u.user_metadata || {}),
              admin_pin_hash: newHash,
              admin_pin_updated_at: new Date().toISOString()
            }
          });
        }
      }
    } catch {
      // ignore sync errors
    }

    return NextResponse.json({
      success: true,
      message: 'Admin PIN updated successfully.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process PIN request.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
