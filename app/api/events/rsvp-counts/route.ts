import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '../../users/user-utils';

export async function GET() {
  try {
    const adminClient = createAdminSupabaseClient();
    const { data, error } = await adminClient
      .from('event_rsvps')
      .select('event_id');

    if (error) {
      return NextResponse.json({ success: true, counts: {} });
    }

    const counts: Record<string, number> = {};
    if (Array.isArray(data)) {
      for (const item of data) {
        const eid = item.event_id;
        if (eid) {
          counts[eid] = (counts[eid] || 0) + 1;
        }
      }
    }

    return NextResponse.json(
      { success: true, counts },
      {
        headers: {
          'CDN-Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
          'Vary': 'Accept-Encoding'
        }
      }
    );
  } catch {
    return NextResponse.json({ success: true, counts: {} });
  }
}
