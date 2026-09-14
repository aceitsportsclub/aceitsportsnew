import { createClient } from '@supabase/supabase-js';

function getRequiredEnv(
  name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  legacyName: 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'
) {
  const value = process.env[name] || process.env[legacyName] || (name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' ? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createSupabaseServerClient() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY')
  );
}
