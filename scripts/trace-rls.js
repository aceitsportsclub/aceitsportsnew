/**
 * Test whether anon-key + Bearer token can SELECT from clubs table
 * This replicates what resolveClub does inside getAuthUserAndProfile
 */
const fs = require('fs');
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
});
const { createClient } = require('@supabase/supabase-js');
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const sbSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const svc = createClient(sbUrl, sbSvc, { auth:{autoRefreshToken:false,persistSession:false}});

async function api(path, { method='GET', body, token } = {}) {
  const headers = { 'Content-Type':'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch('http://localhost:3000' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  try { return { status: r.status, ok: r.ok, body: JSON.parse(text) }; } catch { return { status: r.status, ok: r.ok, body: text }; }
}

async function run() {
  // Get a real admin JWT token
  const loginR = await api('/api/auth/login', { method:'POST', body:{ identifier:'founder', password:'OwnerSecret123!' }});
  const token = loginR.body.token;
  console.log('Got token:', token ? token.substring(0,40)+'...' : 'NONE');

  // Now replicate exactly what announcement-utils getAuthUserAndProfile does:
  // Create anon client with global Authorization header
  const anonWithBearer = createClient(sbUrl, sbAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  // Test 1: Can this client get the user?
  const { data: userData } = await anonWithBearer.auth.getUser(token);
  console.log('\n1. auth.getUser() with anon+bearer:', userData?.user ? 'OK user='+userData.user.id : 'FAILED');

  // Test 2: Can this client read clubs table?
  const { data: clubs, error: clubsErr } = await anonWithBearer.from('clubs').select('id, slug, name').eq('slug','spikers').maybeSingle();
  console.log('2. clubs SELECT with anon+bearer:', clubsErr ? 'ERROR: '+JSON.stringify(clubsErr) : 'OK: '+JSON.stringify(clubs));

  // Test 3: Can anon (no auth) read clubs?
  const anonNoAuth = createClient(sbUrl, sbAnon);
  const { data: clubs2, error: clubs2Err } = await anonNoAuth.from('clubs').select('id,slug').eq('slug','spikers').maybeSingle();
  console.log('3. clubs SELECT with anon (no auth):', clubs2Err ? 'ERROR: '+JSON.stringify(clubs2Err) : 'OK: '+JSON.stringify(clubs2));

  // Test 4: Can this client read announcements table?
  const { data: ann, error: annErr } = await anonWithBearer.from('announcements').select('id').limit(1);
  console.log('4. announcements SELECT with anon+bearer:', annErr ? 'ERROR: '+JSON.stringify(annErr) : 'OK, count='+ann?.length);

  // Test 5: Can this client INSERT into announcements?
  const { data: spikers } = await svc.from('clubs').select('id').eq('slug','spikers').maybeSingle();
  const { data: insertR, error: insertErr } = await anonWithBearer.from('announcements').insert({
    club_id: spikers?.id,
    title: 'BEARER INSERT TEST',
    content: 'test',
    is_pinned: false,
    created_by: userData?.user?.id || null
  }).select().single();
  console.log('5. announcements INSERT with anon+bearer:', insertErr ? 'ERROR: '+JSON.stringify(insertErr) : 'OK id='+insertR?.id);
  if (insertR?.id) {
    await svc.from('announcements').delete().eq('id', insertR.id);
    console.log('   (cleaned up)');
  }

  // Test 6: Read club_memberships with anon+bearer
  const { data: mem, error: memErr } = await anonWithBearer.from('club_memberships').select('club_id,user_id').limit(3);
  console.log('6. club_memberships SELECT with anon+bearer:', memErr ? 'ERROR: '+JSON.stringify(memErr) : 'OK count='+mem?.length);
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
