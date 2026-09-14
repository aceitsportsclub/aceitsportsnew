import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getAuthProfile } from '../../../lib/supabase/auth-profile';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function nullable(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !anonKey) throw new Error('Missing Supabase environment variables');
  return { url, anonKey, serviceKey };
}

export function createAdminSupabaseClient() {
  const { url, serviceKey, anonKey } = getSupabaseEnv();
  const key = serviceKey || anonKey;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
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

  if (cleanRef === 'aceit-spikers') {
    const spikersClub = await supabase.from('clubs').select('id, slug, name').eq('slug', 'spikers').maybeSingle();
    if (spikersClub.data?.id) return spikersClub.data;
  }

  throw new Error('CLUB_NOT_FOUND');
}

export async function getAuthUserAndProfile(
  serverClient: SupabaseClient,
  request: Request
) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

  // Fallback: extract JWT from Supabase cookie (sb-<ref>-auth-token or sb-access-token)
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieMatch =
      cookieHeader.match(/sb-[^=]+-auth-token=([^;]+)/) ||
      cookieHeader.match(/sb-access-token=([^;]+)/);
    if (cookieMatch?.[1]) {
      try {
        const decoded = decodeURIComponent(cookieMatch[1]);
        if (decoded.startsWith('[')) {
          const parsed = JSON.parse(decoded);
          token = Array.isArray(parsed) ? String(parsed[0] || '') : undefined;
        } else if (decoded.startsWith('base64-')) {
          const b64 = decoded.slice('base64-'.length);
          const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
          const parsed = JSON.parse(jsonStr);
          token = parsed?.access_token || (Array.isArray(parsed) ? String(parsed[0]) : undefined);
        } else {
          token = decoded.includes('.') ? decoded : undefined;
        }
      } catch {
        token = undefined;
      }
    }
  }

  let user: User | null = null;
  let activeClient: SupabaseClient = serverClient;

  if (token) {
    const { url, anonKey } = getSupabaseEnv();
    activeClient = createClient(url, anonKey, {
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

export function toSourceAnnouncement(
  row: Record<string, unknown>,
  profileNameMap?: Map<string, string>
) {
  const clubObj = Array.isArray(row.clubs) ? row.clubs[0] : (row.clubs as Record<string, unknown> | null);
  const clubSlug = (clubObj?.slug as string) || 'spikers';
  const createdBy = row.created_by ? String(row.created_by) : null;
  const authorName = (createdBy && profileNameMap?.get(createdBy)) || 'Club Admin';

  const isPinned = Boolean(row.is_pinned ?? row.isPinned ?? false);
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();
  const updatedAt = row.updated_at || row.updatedAt || createdAt;

  return {
    id: row.id,
    _id: row.id,
    clubId: row.club_id,
    club_id: row.club_id,
    club: clubSlug,
    title: row.title,
    category: row.category ?? null,
    content: row.content,
    isPinned,
    is_pinned: isPinned,
    authorName,
    createdBy,
    created_by: createdBy,
    createdAt,
    created_at: createdAt,
    updatedAt,
    updated_at: updatedAt
  };
}
