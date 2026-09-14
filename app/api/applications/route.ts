import { NextResponse } from 'next/server';
import { createSupabaseAuthServerClient } from '../../../lib/supabase/auth-server';
import {
  assertCanManageClub,
  getAuthUserAndProfile,
  nullable,
  resolveClub,
  toSourceApplication
} from './application-utils';

export async function GET(request: Request) {
  try {
    const serverClient = await createSupabaseAuthServerClient();
    const { profile, supabase } = await getAuthUserAndProfile(serverClient, request);

    const url = new URL(request.url);
    const clubParam = url.searchParams.get('clubId')?.trim();

    let query = supabase
      .from('applications')
      .select('*, clubs(id, slug, name)');

    if (clubParam && clubParam.toLowerCase() !== 'all') {
      const resolved = await resolveClub(supabase, clubParam);
      assertCanManageClub(profile, resolved.id);
      query = query.eq('club_id', resolved.id);
    } else {
      // If user is not OWNER, restrict to clubs they are authorized to manage
      if (profile.role !== 'OWNER') {
        if (!profile.clubs || profile.clubs.length === 0) {
          return NextResponse.json({ success: true, applications: [] });
        }
        query = query.in('club_id', profile.clubs);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    const applications = (data ?? []).map(toSourceApplication);
    return NextResponse.json({ success: true, applications });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load applications.';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 400;
    return NextResponse.json({ success: false, applications: [], message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const clubRef = String(body.clubId || body.club || body.club_id || '').trim();

    if (!clubRef || clubRef.toLowerCase() === 'all') {
      return NextResponse.json(
        { success: false, message: 'Please select a specific sports club before submitting your application.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseAuthServerClient();
    const resolvedClub = await resolveClub(supabase, clubRef);

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, message: 'Name and email are required to submit an application.' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    // Optional user association if user is logged in
    let userId: string | null = null;
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      userId = authData.user.id;
    }

    const { error: insertError } = await supabase
      .from('applications')
      .insert({
        club_id: resolvedClub.id,
        user_id: userId,
        name,
        email,
        phone: nullable(body.phone),
        position: nullable(body.position),
        experience: nullable(body.experience),
        message: nullable(body.message),
        source: nullable(body.source) || 'Website Form',
        status: 'Pending'
      });

    if (insertError) throw insertError;

    return NextResponse.json({
      success: true,
      message: 'Your application has been received successfully.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit application.';
    const status = message === 'CLUB_NOT_FOUND' || message === 'CLUB_REQUIRED' ? 400 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}
