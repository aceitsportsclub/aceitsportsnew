import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthProfile } from '../../../../lib/supabase/auth-profile';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';

function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : undefined);
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

/**
 * Create a Supabase client using the service-role key.
 * Used ONLY for username→email lookup (bypasses RLS on profiles table).
 * Never used for actual authentication.
 */
function createServiceRoleClient() {
  const url = getEnvVar('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const serviceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const identifier =
    (typeof body.username === 'string' ? body.username.trim() : '') ||
    (typeof body.email === 'string' ? body.email.trim() : '') ||
    (typeof body.identifier === 'string' ? body.identifier.trim() : '');
  const password = typeof body.password === 'string' ? body.password : '';

  if (!identifier || !password) {
    return NextResponse.json(
      { success: false, message: 'Please enter both username/email and password.' },
      { status: 400 }
    );
  }

  // Resolve username → email using service-role client (bypasses RLS)
  let email = identifier.trim().toLowerCase();

  if (!email.includes('@')) {
    try {
      const adminClient = createServiceRoleClient();
      const { data: profile, error: lookupErr } = await adminClient
        .from('profiles')
        .select('email')
        .ilike('username', identifier.trim())
        .maybeSingle();

      if (profile?.email) {
        email = profile.email.trim().toLowerCase();
      } else {
        // Fallback: search auth users metadata for username
        const { data: authList } = await adminClient.auth.admin.listUsers();
        const found = authList?.users?.find(
          (u) =>
            (typeof u.user_metadata?.username === 'string' &&
              u.user_metadata.username.toLowerCase() === identifier.trim().toLowerCase()) ||
            (u.email && u.email.toLowerCase() === identifier.trim().toLowerCase())
        );
        if (found?.email) {
          email = found.email.trim().toLowerCase();
        } else {
          return NextResponse.json(
            { success: false, message: 'Login failed. Incorrect credentials.' },
            { status: 401 }
          );
        }
      }
    } catch (lookupEx) {
      console.error('[Login] Service-role lookup exception:', lookupEx);
      return NextResponse.json(
        { success: false, message: 'Login failed. Incorrect credentials.' },
        { status: 401 }
      );
    }
  }

  // Authenticate with Supabase Auth using email + password
  const supabase = await createSupabaseAuthServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const errCode = (error as { code?: string } | null)?.code ?? '';
    if (errCode === 'invalid_credentials' || errCode === 'email_not_confirmed') {
      return NextResponse.json(
        { success: false, message: 'Login failed. Incorrect credentials.' },
        { status: 401 }
      );
    }
    console.error('[Login] Supabase signInWithPassword error:', error?.message ?? 'no user');
    return NextResponse.json(
      { success: false, message: 'Login failed. Incorrect credentials.' },
      { status: 401 }
    );
  }

  try {
    const user = await getAuthProfile(supabase, data.user);
    return NextResponse.json({
      success: true,
      user,
      profile: user,
      permissions: user.permissions,
      role: user.role,
      token: data.session?.access_token
    });
  } catch (profileErr) {
    console.error('[Login] getAuthProfile error:', profileErr);
    // Auth succeeded but profile read failed — return minimal session anyway
    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        _id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.name ?? email,
        username: data.user.user_metadata?.username ?? email,
        role: 'STUDENT',
        permissions: ['profile.view', 'profile.edit', 'clubs.join'],
        clubs: [],
        clubId: ''
      },
      token: data.session?.access_token
    });
  }
}
