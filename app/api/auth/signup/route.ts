import { NextResponse } from 'next/server';
import { getAuthProfile } from '../../../../lib/supabase/auth-profile';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';
import { createAdminSupabaseClient, resolveClub } from '../../users/user-utils';

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { contentType: match[1], data: Buffer.from(match[2], 'base64') };
}

function extensionFor(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!name || !username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Please fill in all required fields (*).' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminSupabaseClient();

    // 1. Check duplicate username
    const { data: existingUserByUsername } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existingUserByUsername) {
      return NextResponse.json(
        { success: false, message: 'Username is already taken. Please choose another username.' },
        { status: 400 }
      );
    }

    // 2. Check duplicate email
    const { data: existingUserByEmail } = await adminClient
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle();

    if (existingUserByEmail) {
      return NextResponse.json(
        { success: false, message: 'An account with this email address already exists. Please sign in.' },
        { status: 400 }
      );
    }

    // 3. Resolve target club
    const clubRef = String(body.clubId || (Array.isArray(body.clubs) ? body.clubs[0] : null) || 'spikers');
    let targetClub = { id: 'ca85f3e3-e35b-474e-b058-6bbab1d86cdb', slug: 'spikers' };
    try {
      const resolved = await resolveClub(adminClient, clubRef);
      targetClub = { id: resolved.id, slug: resolved.slug };
    } catch {
      // fallback to spikers
    }

    // 4. Handle photo upload if data URL
    let photoUrl: string | null = null;
    if (typeof body.photo === 'string' && body.photo.trim()) {
      const rawPhoto = body.photo.trim();
      const parsedData = parseDataUrl(rawPhoto);
      if (parsedData) {
        try {
          const ext = extensionFor(parsedData.contentType);
          const uploadPath = `${targetClub.slug}/student-${username}-${Date.now()}.${ext}`;
          const { error: uploadErr } = await adminClient.storage
            .from('player-photos')
            .upload(uploadPath, parsedData.data, {
              contentType: parsedData.contentType,
              upsert: true
            });

          if (!uploadErr) {
            const { data: publicData } = adminClient.storage
              .from('player-photos')
              .getPublicUrl(uploadPath);
            photoUrl = publicData.publicUrl;
          } else {
            console.warn('[Signup] Photo storage upload error:', uploadErr.message);
          }
        } catch (photoEx) {
          console.warn('[Signup] Photo upload exception:', photoEx);
        }
      } else if (rawPhoto.startsWith('http://') || rawPhoto.startsWith('https://')) {
        photoUrl = rawPhoto;
      }
    }

    // 5. Create Auth User using Server-Side Admin API (avoids email rate-limits)
    const studentPerms = ['profile.view', 'profile.edit', 'clubs.join'];
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        username,
        rtuRollNo: typeof body.rtuRollNo === 'string' ? body.rtuRollNo.trim() : null,
        mobile: typeof body.mobile === 'string' ? body.mobile.trim() : null,
        branch: typeof body.branch === 'string' ? body.branch : null,
        year: typeof body.year === 'string' ? body.year : null,
        photo: photoUrl,
        role: 'STUDENT',
        permissions: studentPerms,
        custom_permissions: studentPerms
      }
    });

    if (authError || !authData?.user) {
      const errMsg = authError?.message || 'Registration failed.';
      if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists')) {
        return NextResponse.json(
          { success: false, message: 'An account with this email address already exists. Please sign in.' },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: false, message: errMsg }, { status: 400 });
    }

    const newUserId = authData.user.id;

    // 6. Upsert into profiles table
    const { data: profileRow, error: profileErr } = await adminClient
      .from('profiles')
      .upsert({
        id: newUserId,
        name,
        username,
        email,
        rtu_roll_no: typeof body.rtuRollNo === 'string' ? body.rtuRollNo.trim() : null,
        mobile: typeof body.mobile === 'string' ? body.mobile.trim() : null,
        branch: typeof body.branch === 'string' ? body.branch : null,
        year: typeof body.year === 'string' ? body.year : null,
        sport: typeof body.sport === 'string' ? body.sport : null,
        photo: photoUrl,
        active: true
      })
      .select()
      .single();

    if (profileErr) {
      console.error('[Signup] profile error:', profileErr);
      return NextResponse.json({ success: false, message: 'Failed to create student profile.' }, { status: 500 });
    }

    // 7. Assign STUDENT role and club membership
    const { data: studentRole } = await adminClient
      .from('roles')
      .select('id')
      .ilike('name', 'STUDENT')
      .maybeSingle();

    if (studentRole?.id) {
      await adminClient.from('user_roles').upsert({
        user_id: newUserId,
        role_id: studentRole.id
      });

      await adminClient.from('club_memberships').upsert({
        user_id: newUserId,
        club_id: targetClub.id,
        role_id: studentRole.id,
        active: true,
        custom_permissions: studentPerms
      });
    }

    // 8. Sign in the student so cookie session and token are established
    const serverClient = await createSupabaseAuthServerClient();
    const { data: signInData, error: signInError } = await serverClient.auth.signInWithPassword({
      email,
      password
    });

    if (signInError || !signInData.user) {
      const sourceUser = {
        id: newUserId,
        _id: newUserId,
        name,
        username,
        email,
        role: 'STUDENT',
        permissions: studentPerms,
        clubs: [targetClub.slug],
        clubId: targetClub.slug,
        photo: photoUrl
      };
      return NextResponse.json({ success: true, user: sourceUser });
    }

    const userProfile = await getAuthProfile(serverClient, signInData.user);
    return NextResponse.json({
      success: true,
      user: userProfile,
      token: signInData.session?.access_token
    });
  } catch (error) {
    console.error('[Signup] exception:', error);
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
