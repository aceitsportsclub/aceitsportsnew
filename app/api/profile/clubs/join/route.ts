import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../../../lib/supabase/auth-server';
import {
  createAdminSupabaseClient,
  getAuthUserAndProfile,
  resolveClub
} from '../../../users/user-utils';

export async function POST(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { user, profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const body = await request.json().catch(() => ({}));
    const clubRef = String(body.clubSlug || body.slug || body.clubId || body.club || '').trim();

    if (!clubRef) {
      return NextResponse.json(
        { success: false, message: 'Club identifier is required.' },
        { status: 400 }
      );
    }

    const adminClient = createAdminSupabaseClient();
    const club = await resolveClub(adminClient, clubRef);

    // Fetch STUDENT role ID
    const { data: studentRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', 'STUDENT')
      .maybeSingle();

    const roleId = studentRole?.id;

    // Check if membership already exists
    const { data: existingMember } = await adminClient
      .from('club_memberships')
      .select('id, active')
      .eq('user_id', user.id)
      .eq('club_id', club.id)
      .maybeSingle();

    if (existingMember) {
      if (!existingMember.active) {
        await adminClient
          .from('club_memberships')
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq('id', existingMember.id);
      }
    } else {
      await adminClient.from('club_memberships').insert({
        user_id: user.id,
        club_id: club.id,
        role_id: roleId,
        active: true,
        custom_permissions: ['profile.view', 'profile.edit', 'clubs.join']
      });
    }

    // Fetch all active club memberships for this user
    const { data: memberships } = await adminClient
      .from('club_memberships')
      .select('club_id, active, clubs(slug)')
      .eq('user_id', user.id)
      .eq('active', true);

    const clubs: string[] = [];
    (memberships ?? []).forEach((m) => {
      const cObj = Array.isArray(m.clubs) ? m.clubs[0] : (m.clubs as { slug?: string } | null);
      const cSlug = cObj?.slug || '';
      if (cSlug && !clubs.includes(cSlug)) clubs.push(cSlug);
    });

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${club.name}.`,
      clubs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to join club.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'CLUB_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
