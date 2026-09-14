/**
 * Precise trace: what does assertCanManageClub receive from an admin user?
 * Replicate getAuthUserAndProfile + assertCanManageClub exactly
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

async function api(path, opts = {}) {
  const { method='GET', body, token } = opts;
  const headers = { 'Content-Type':'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch('http://localhost:3000' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  try { return { status: r.status, ok: r.ok, body: JSON.parse(text) }; } catch { return { status: r.status, ok: r.ok, body: text }; }
}

async function run() {
  // 1. Create temp admin
  const { data: al } = await svc.auth.admin.listUsers();
  const ex = (al?.users||[]).find(u=>u.email==='qa.rls2.admin@aceit.test');
  if (ex) {
    await svc.from('club_memberships').delete().eq('user_id',ex.id);
    await svc.from('user_roles').delete().eq('user_id',ex.id);
    await svc.from('profiles').delete().eq('id',ex.id);
    await svc.auth.admin.deleteUser(ex.id);
  }

  const ownerLogin = await api('/api/auth/login', { method:'POST', body:{ identifier:'founder', password:'OwnerSecret123!' }});
  const ownerToken = ownerLogin.body.token;

  await api('/api/users', { method:'POST', token:ownerToken,
    body:{ name:'QA RLS2 Admin', username:'qa_rls2_admin', email:'qa.rls2.admin@aceit.test',
      password:'RLS2Admin2026!', club:'spikers', role:'ADMINS',
      permissions:['news.*','players.*'] }
  });
  await new Promise(r=>setTimeout(r,1200));

  const adminLogin = await api('/api/auth/login', { method:'POST', body:{ identifier:'qa.rls2.admin@aceit.test', password:'RLS2Admin2026!' }});
  const adminToken = adminLogin.body.token;
  const adminUserId = adminLogin.body.user?.id;
  console.log('Admin token obtained:', !!adminToken);

  // 2. Exactly replicate getAuthUserAndProfile
  const anonClient = createClient(sbUrl, sbAnon, {
    global: { headers: { Authorization: `Bearer ${adminToken}` } }
  });
  const { data: userData } = await anonClient.auth.getUser(adminToken);
  const user = userData?.user;
  console.log('User id:', user?.id);

  // 3. Replicate getAuthProfile
  const [{ data: profile }, { data: roleRows }, { data: memberships }] = await Promise.all([
    anonClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    anonClient.from('user_roles').select('roles(name, permissions)').eq('user_id', user.id),
    anonClient.from('club_memberships').select('club_id, custom_permissions, roles(name, permissions), clubs(id, slug, name)').eq('user_id', user.id).eq('active', true)
  ]);

  console.log('Profile found:', !!profile);
  console.log('Memberships:', JSON.stringify(memberships));
  console.log('Role rows:', JSON.stringify(roleRows));

  // Build clubs list (same as auth-profile.ts)
  const allClubIdentifiers = [];
  (memberships || []).forEach(m => {
    const cObj = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
    const slug = ((cObj?.slug) || '').toLowerCase().trim();
    const uuid = String(m.club_id || '').toLowerCase().trim();
    if (slug && !allClubIdentifiers.includes(slug)) allClubIdentifiers.push(slug);
    if (uuid && !allClubIdentifiers.includes(uuid)) allClubIdentifiers.push(uuid);
  });
  console.log('Computed allClubIdentifiers:', allClubIdentifiers);

  // 4. Replicate resolveClub('spikers')
  const { data: spikersClub } = await anonClient.from('clubs').select('id, slug, name').eq('slug','spikers').maybeSingle();
  console.log('Resolved club:', JSON.stringify(spikersClub));
  console.log('spikersClub.id:', spikersClub?.id);
  console.log('allClubIdentifiers.includes(spikersClub.id):', allClubIdentifiers.includes(spikersClub?.id));
  console.log('allClubIdentifiers.includes("spikers"):', allClubIdentifiers.includes('spikers'));

  // 5. assertCanManageClub check
  const profileObj = { role: 'ADMINS', clubs: allClubIdentifiers };
  const clubId = spikersClub?.id;
  console.log('\nassertCanManageClub:');
  console.log('  profile.role === OWNER?', profileObj.role === 'OWNER');
  console.log('  profile.clubs.includes(club.id)?', profileObj.clubs.includes(clubId));
  console.log('  → RESULT:', (profileObj.role === 'OWNER' || profileObj.clubs.includes(clubId)) ? 'PASS (allowed)' : '*** BLOCKED - FORBIDDEN ***');

  // Cleanup
  const { data: al2 } = await svc.auth.admin.listUsers();
  const qa = (al2?.users||[]).find(u=>u.email==='qa.rls2.admin@aceit.test');
  if (qa) {
    await svc.from('club_memberships').delete().eq('user_id',qa.id);
    await svc.from('user_roles').delete().eq('user_id',qa.id);
    await svc.from('profiles').delete().eq('id',qa.id);
    await svc.auth.admin.deleteUser(qa.id);
    console.log('\nCleaned up.');
  }
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
