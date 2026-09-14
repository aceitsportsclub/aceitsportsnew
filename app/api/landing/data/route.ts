import { NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { createSupabaseAuthServerClient } from '../../../../lib/supabase/auth-server';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'landing-config.json');

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('Failed reading landing config:', err);
  }
  return null;
}

export async function GET() {
  try {
    const supabase = await createSupabaseAuthServerClient();

    const [clubsRes, matchesRes, eventsRes] = await Promise.all([
      supabase.from('clubs').select('*').eq('active', true).order('name', { ascending: true }),
      supabase.from('matches').select('*, clubs(id, slug, name, logo)').order('date', { ascending: true }),
      supabase.from('events').select('*, clubs(id, slug, name, logo)').order('date', { ascending: true })
    ]);

    if (clubsRes.error) {
      console.warn('Error fetching clubs for landing:', clubsRes.error);
    }
    if (matchesRes.error) {
      console.warn('Error fetching matches for landing:', matchesRes.error);
    }
    if (eventsRes.error) {
      console.warn('Error fetching events for landing:', eventsRes.error);
    }

    const clubs = (clubsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      sport: c.sport,
      slug: c.slug,
      logo: c.logo,
      loaderLogo: c.loader_logo,
      coverImage: c.cover_image,
      description: c.description,
      themeColor: c.theme_color,
      accentColor: c.accent_color,
      active: c.active
    }));

    const matches = (matchesRes.data ?? []).map((m) => {
      const clubObj = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
      return {
        id: m.id,
        clubId: m.club_id,
        clubSlug: clubObj?.slug || 'spikers',
        clubName: clubObj?.name || 'ACEIT Sports',
        clubLogo: clubObj?.logo || null,
        team1: m.team1,
        team1Logo: m.team1_logo,
        team2: m.team2 || m.opponent,
        opponent: m.opponent || m.team2,
        team2Logo: m.team2_logo,
        date: m.date,
        venue: m.venue,
        status: m.status,
        score1: m.score1,
        score2: m.score2,
        sets: m.sets,
        winner: m.winner,
        isLive: m.is_live
      };
    });

    const events = (eventsRes.data ?? []).map((e) => {
      const clubObj = Array.isArray(e.clubs) ? e.clubs[0] : e.clubs;
      return {
        id: e.id,
        clubId: e.club_id,
        clubSlug: clubObj?.slug || 'spikers',
        clubName: clubObj?.name || 'ACEIT Sports',
        clubLogo: clubObj?.logo || null,
        poster: e.poster,
        title: e.title,
        date: e.date,
        time: e.time,
        venue: e.venue,
        description: e.description,
        registrationButtonText: e.registration_button_text,
        registrationUrl: e.registration_url,
        registrationEnabled: e.registration_enabled
      };
    });

    const config = readConfig();

    return NextResponse.json(
      {
        success: true,
        clubs,
        matches,
        events,
        config
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300'
        }
      }
    );
  } catch (error) {
    console.error('[Landing Data Error]', error);
    return NextResponse.json(
      { success: false, message: 'Unable to load landing data', clubs: [], matches: [], events: [], config: null },
      { status: 500 }
    );
  }
}
