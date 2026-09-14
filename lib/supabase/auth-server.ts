import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY', legacyName: 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY') {
  const value = process.env[name] || process.env[legacyName] || (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function createSupabaseAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Cookie writes can be unavailable during some server render phases.
          }
        }
      }
    }
  );
}
