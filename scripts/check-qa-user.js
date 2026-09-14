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
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(url, key);

async function check() {
  const { data: p } = await sb.from('profiles').select('*').eq('username', 'qa_spikers_admin');
  console.log('Profile:', p);
  if (p && p.length > 0) {
    const uid = p[0].id;
    const { data: m } = await sb.from('club_memberships').select('*, roles(*), clubs(*)').eq('user_id', uid);
    console.log('Memberships:', m);
    const { data: r } = await sb.from('user_roles').select('*, roles(*)').eq('user_id', uid);
    console.log('User roles:', r);
  }
}
check();
