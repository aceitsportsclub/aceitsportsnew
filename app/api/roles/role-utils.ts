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
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) throw new Error('Missing Supabase environment variables');
  return { url, anonKey, serviceKey };
}

export function createAdminSupabaseClient() {
  const { url, anonKey, serviceKey } = getSupabaseEnv();
  const key = serviceKey || anonKey;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
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

export function assertCanManageRoles(profile: { role: string; permissions?: string[] }) {
  if (profile.role === 'OWNER') return true;
  const perms = Array.isArray(profile.permissions) ? profile.permissions : [];
  if (perms.includes('*') || perms.includes('settings.*') || perms.includes('users.*')) {
    return true;
  }
  throw new Error('FORBIDDEN');
}

export const SEEDED_ROLES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'OWNER',
    title: 'Owner',
    description: 'Global owner with full access.',
    badge_bg: '#D4AC0D',
    badge_text: '#FFFFFF',
    badge_glow: 'rgba(212, 172, 13, 0.85)',
    permissions: ['*'],
    is_system: true
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'STUDENT',
    title: 'Student',
    description: 'Student profile and club membership access.',
    badge_bg: '#27AE60',
    badge_text: '#FFFFFF',
    badge_glow: 'rgba(39, 174, 96, 0.65)',
    permissions: ['profile.view', 'profile.edit', 'clubs.join'],
    is_system: true
  }
];

export const VALID_PERMISSIONS = [
  '*',
  'players.*',
  'matches.*',
  'news.*',
  'gallery.*',
  'training.*',
  'events.*',
  'slideshow.*',
  'applications.*',
  'users.*',
  'clubs.*',
  'testimonials.*',
  'sponsors.*',
  'stats.*',
  'about.*',
  'contact.*',
  'settings.*',
  'landing.*',
  'master_landing.*'
];

export function toSourceRole(role: Record<string, unknown>) {
  const id = String(role.id || '');
  const name = String(role.name || '').toUpperCase().trim();
  const title = String(role.title || role.roleTitle || name);
  const description = (role.description as string) || '';
  const badgeBg = (role.badge_bg as string) || (role.badgeBg as string) || (name === 'OWNER' ? '#D4AC0D' : (name === 'ADMIN' ? '#2980B9' : '#8E44AD'));
  const badgeText = (role.badge_text as string) || (role.badgeText as string) || '#FFFFFF';
  const badgeGlow = (role.badge_glow as string) || (role.badgeGlow as string) || (name === 'OWNER' ? 'rgba(212, 172, 13, 0.85)' : (name === 'ADMIN' ? 'rgba(41, 128, 185, 0.85)' : 'rgba(142, 68, 173, 0.85)'));
  const permissions = Array.isArray(role.permissions) ? (role.permissions as string[]) : (name === 'OWNER' ? ['*'] : []);
  const isSystem = Boolean(role.is_system || role.isSystem || name === 'OWNER' || name === 'STUDENT');

  return {
    id,
    _id: id,
    name,
    title,
    roleTitle: title,
    description,
    badgeBg,
    badgeText,
    badgeGlow,
    badge_bg: badgeBg,
    badge_text: badgeText,
    badge_glow: badgeGlow,
    permissions,
    isSystem,
    is_system: isSystem,
    created_at: (role.created_at as string) || new Date().toISOString(),
    updated_at: (role.updated_at as string) || new Date().toISOString()
  };
}
