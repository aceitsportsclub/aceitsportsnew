/**
 * Root-cause diagnostic for:
 * 1. GET /api/users → UNAUTHENTICATED (when called from admin UI without Bearer token)
 * 2. POST /api/announcements → "Unable to create announcement"
 */
const fs = require('fs');
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
});

const BASE = 'http://localhost:3000';
const { createClient } = require('@supabase/supabase-js');
const sbSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = createClient(sbUrl, sbSvc, { auth: { autoRefreshToken:false, persistSession:false }});

async function api(path, { method='GET', body, token } = {}) {
  const headers = { 'Content-Type':'application/json', 'Accept':'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const r = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: r.status, ok: r.ok, body: json };
}

async function login(id, pw) {
  const r = await api('/api/auth/login', { method:'POST', body:{ identifier:id, password:pw }});
  if (!r.ok || !r.body.token) throw new Error('Login failed: ' + JSON.stringify(r.body));
  return r.body.token;
}

async function run() {
  console.log('== DIAGNOSTIC ==\n');

  // Get owner token
  const ownerToken = await login('founder', 'OwnerSecret123!');
  console.log('✅ Owner login OK');

  // TEST 1a: GET /api/users WITH Bearer token (what API tests do — should work)
  const withToken = await api('/api/users', { token: ownerToken });
  console.log('\n1a. GET /api/users WITH Bearer token:', withToken.status, withToken.ok ? 'OK' : withToken.body?.message);

  // TEST 1b: GET /api/users WITHOUT any token (what browser does if cookies aren't set)
  const withoutToken = await api('/api/users');
  console.log('1b. GET /api/users WITHOUT Bearer token (simulates browser without cookie session):', withoutToken.status, withoutToken.body?.message);
  // This should tell us: does the cookie-based session fallback work?

  // TEST 2: POST /api/announcements — check what errors come back
  // First: without token
  const noTokenAnnounce = await api('/api/announcements', {
    method: 'POST',
    body: { title:'Test Notice', content:'Test body', club:'spikers', clubId:'spikers' }
  });
  console.log('\n2a. POST /api/announcements WITHOUT token:', noTokenAnnounce.status, noTokenAnnounce.body?.message);

  // With owner token
  const withTokenAnnounce = await api('/api/announcements', {
    method: 'POST',
    token: ownerToken,
    body: { title:'Test Notice', content:'Test body', club:'spikers', clubId:'spikers' }
  });
  console.log('2b. POST /api/announcements WITH owner token:', withTokenAnnounce.status, withTokenAnnounce.ok ? 'SUCCESS' : withTokenAnnounce.body?.message);

  // Check if the announcements table exists and has the right columns
  const { data: annTable, error: annErr } = await svc.from('announcements').select('*').limit(1);
  console.log('\n2c. Supabase announcements table check:', annErr ? 'ERROR: '+JSON.stringify(annErr) : 'OK, cols: ' + Object.keys(annTable?.[0] || {}).join(', '));

  // Attempt direct insert to see DB error
  const { data: spikers } = await svc.from('clubs').select('id').eq('slug','spikers').maybeSingle();
  const { data: insertTest, error: insertErr } = await svc.from('announcements').insert({
    club_id: spikers?.id,
    title: 'DIAG TEST',
    content: 'DIAG BODY',
    is_pinned: false,
    created_by: null
  }).select().single();
  console.log('2d. Direct Supabase insert test:', insertErr ? 'ERROR: ' + JSON.stringify(insertErr) : 'SUCCESS id=' + insertTest?.id);
  if (insertTest?.id) {
    await svc.from('announcements').delete().eq('id', insertTest.id);
    console.log('    (cleaned up)');
  }

  // Check actual admin UI user — does it have the 'news' permission?
  // Create a full test admin and check announcement creation
  const { data: authList } = await svc.auth.admin.listUsers();
  const existingQA = (authList?.users||[]).find(u=>u.email==='qa.diag.admin@aceit.test');
  if (existingQA) {
    await svc.from('club_memberships').delete().eq('user_id', existingQA.id);
    await svc.from('user_roles').delete().eq('user_id', existingQA.id);
    await svc.from('profiles').delete().eq('id', existingQA.id);
    await svc.auth.admin.deleteUser(existingQA.id);
  }

  const createR = await api('/api/users', {
    method: 'POST', token: ownerToken,
    body: { name:'QA Diag Admin', username:'qa_diag_admin', email:'qa.diag.admin@aceit.test',
      password:'DiagAdmin2026!', club:'spikers', role:'ADMINS',
      permissions:['news.*','players.*','gallery.*','matches.*','events.*','contact.*','slideshow.*','testimonials.*','stats.*','applications.*'] }
  });
  console.log('\n3a. Create diag admin:', createR.status, createR.ok ? 'OK' : createR.body?.message);

  await new Promise(r=>setTimeout(r,1500));
  const adminToken = await login('qa.diag.admin@aceit.test','DiagAdmin2026!').catch(e=>{console.log('Admin login failed:',e.message); return null;});
  if (adminToken) {
    console.log('3b. Diag admin login: OK');

    const meR = await api('/api/auth/me', { token: adminToken });
    console.log('3c. Admin profile clubs:', JSON.stringify(meR.body?.user?.clubs || meR.body?.profile?.clubs || []));
    console.log('    Admin profile perms:', JSON.stringify(meR.body?.user?.permissions || meR.body?.profile?.permissions || []));

    // Try creating announcement as admin
    const adminAnnounce = await api('/api/announcements', {
      method: 'POST', token: adminToken,
      body: { title:'DIAG NOTICE', content:'DIAG CONTENT', club:'spikers', clubId:'spikers' }
    });
    console.log('3d. POST /api/announcements as admin:', adminAnnounce.status, adminAnnounce.ok ? 'SUCCESS' : adminAnnounce.body?.message);

    // Now test without token (simulates admin UI without sending Bearer)
    const adminAnnounceNoToken = await api('/api/announcements', {
      method: 'POST',
      body: { title:'DIAG NOTICE NO TOKEN', content:'DIAG CONTENT', club:'spikers', clubId:'spikers' }
    });
    console.log('3e. POST /api/announcements as admin WITHOUT token:', adminAnnounceNoToken.status, adminAnnounceNoToken.body?.message);
  }

  // Check /api/auth/login response structure
  const loginR = await api('/api/auth/login', { method:'POST', body:{ identifier:'founder', password:'OwnerSecret123!' }});
  console.log('\n4. /api/auth/login response keys:', Object.keys(loginR.body).join(', '));
  console.log('   token present:', !!loginR.body.token);
  console.log('   user keys:', Object.keys(loginR.body.user || loginR.body.profile || {}).join(', '));

  // Cleanup
  const { data: al2 } = await svc.auth.admin.listUsers();
  const qa = (al2?.users||[]).find(u=>u.email==='qa.diag.admin@aceit.test');
  if (qa) {
    await svc.from('club_memberships').delete().eq('user_id', qa.id);
    await svc.from('user_roles').delete().eq('user_id', qa.id);
    await svc.from('profiles').delete().eq('id', qa.id);
    await svc.auth.admin.deleteUser(qa.id);
    console.log('\n✅ Cleaned up diag admin');
  }

  // Clean up the test announcement if it exists
  await svc.from('announcements').delete().ilike('title', 'DIAG%');
}

run().catch(e => { console.error('CRASH:', e); process.exit(1); });
