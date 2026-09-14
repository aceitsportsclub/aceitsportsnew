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

    // Deactivate or remove membership for this club only
    await adminClient
      .from('club_memberships')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('club_id', club.id);

    // Fetch remaining active club memberships for this user
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
      message: `Left ${club.name}.`,
      clubs
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to leave club.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'CLUB_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
