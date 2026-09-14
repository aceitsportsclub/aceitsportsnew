import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { getAuthProfile } from '../../../lib/supabase/auth-profile';

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

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

export function toSourceNotification(row: Record<string, unknown>) {
  const id = String(row.id || '');
  const createdAt = (row.created_at as string) || new Date().toISOString();
  return {
    id,
    _id: id,
    userId: String(row.user_id || ''),
    clubId: String(row.club_id || ''),
    title: String(row.title || ''),
    message: String(row.message || ''),
    type: String(row.type || 'announcement'),
    read: Boolean(row.read),
    createdAt,
    created_at: createdAt,
    linkUrl: '#notice-board'
  };
}
