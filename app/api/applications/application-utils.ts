import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getAuthProfile } from '../../../lib/supabase/auth-profile';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function nullable(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase environment variables');
  return { url, key };
}

export async function resolveClub(
  supabase: SupabaseClient,
  ref: string
): Promise<{ id: string; slug: string; name: string }> {
  const cleanRef = (ref || '').trim().toLowerCase();

  if (!cleanRef || cleanRef === 'all') {
    throw new Error('CLUB_REQUIRED');
  }

  if (isUuid(cleanRef)) {
    const byId = await supabase.from('clubs').select('id, slug, name').eq('id', cleanRef).maybeSingle();
    if (byId.data?.id) return byId.data;
  }

  const bySlug = await supabase.from('clubs').select('id, slug, name').eq('slug', cleanRef).maybeSingle();
  if (bySlug.data?.id) return bySlug.data;

  throw new Error('CLUB_NOT_FOUND');
}

export async function getAuthUserAndProfile(
  serverClient: SupabaseClient,
  request: Request
) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

  let user: User | null = null;
  let activeClient: SupabaseClient = serverClient;

  if (token) {
    const { url, key } = getSupabaseEnv();
    activeClient = createClient(url, key, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
    const { data: userData } = await activeClient.auth.getUser(token);
    user = userData?.user ?? null;
  }

  if (!user) {
    const { data: authData } = await serverClient.auth.getUser();
    user = authData?.user ?? null;
    activeClient = serverClient;
  }

  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }

  const profile = await getAuthProfile(activeClient, user);
  return { user, profile, supabase: activeClient };
}

export function assertCanManageClub(
  profile: { role: string; clubs: string[] },
  clubId: string
) {
  if (profile.role === 'OWNER') return true;
  if (profile.clubs.includes(clubId)) return true;
  throw new Error('FORBIDDEN');
}

export function toSourceApplication(row: Record<string, unknown>) {
  const clubObj = Array.isArray(row.clubs) ? row.clubs[0] : (row.clubs as Record<string, unknown> | null);
  const clubSlug = (clubObj?.slug as string) || 'spikers';
  const createdAt = (row.created_at as string) || new Date().toISOString();
  const updatedAt = (row.updated_at as string) || createdAt;

  return {
    id: row.id,
    _id: row.id,
    clubId: row.club_id,
    club_id: row.club_id,
    clubSlug,
    club: clubSlug,
    userId: row.user_id || null,
    user_id: row.user_id || null,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    position: row.position || '',
    experience: row.experience || '',
    message: row.message || '',
    source: row.source || 'Website Form',
    status: row.status || 'Pending',
    date: createdAt,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt
  };
}
