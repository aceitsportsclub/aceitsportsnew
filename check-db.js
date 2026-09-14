const fs = require('fs');
const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
lines.forEach(l => {
  const idx = l.indexOf('=');
  if (idx > 0 && !l.startsWith('#')) {
    const k = l.slice(0, idx).trim();
    const v = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    process.env[k] = v;
  }
});
const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function run() {
  const { data: clubs, error: cErr } = await supabase.from('clubs').select('id, slug, name');
  console.log('CLUBS:', clubs);

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, email, name');
  console.log('PROFILES:', profiles?.slice(0, 5));

  const { data: roles } = await supabase.from('roles').select('id, name');
  console.log('ROLES:', roles);
}
run();
