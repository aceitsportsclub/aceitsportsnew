import { NextResponse } from 'next/server';
import { getAuthProfile } from '../../../../lib/supabase/auth-profile';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import { getAuthUserAndProfile } from '../../users/user-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    if (!user) {
      return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    }

    const { data: sessionData } = await supabase.auth.getSession();

    const effectiveProfile = profile || (await getAuthProfile(supabase, user));

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: effectiveProfile,
      profile: effectiveProfile,
      permissions: effectiveProfile.permissions,
      role: effectiveProfile.role,
      token: sessionData?.session?.access_token
    });
  } catch {
    return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
  }
}
