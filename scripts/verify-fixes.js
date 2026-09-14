/**
 * Verify both fixes:
 * 1. Users API works for bearer-token admin
 * 2. Announcements CRUD works for bearer-token admin
 */
const fs = require('fs');
fs.readFileSync('.env.local', 'utf8').split('\n').forEach(l => {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0,i).trim()] = l.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
});
const { createClient } = require('@supabase/supabase-js');
const sbSvc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  console.log('== VERIFYING BOTH FIXES ==\n');

  // Setup: cleanup and create admin
  const { data: al } = await svc.auth.admin.listUsers();
  const ex = (al?.users||[]).find(u=>u.email==='qa.verify.admin@aceit.test');
  if (ex) {
    await svc.from('club_memberships').delete().eq('user_id',ex.id);
    await svc.from('user_roles').delete().eq('user_id',ex.id);
    await svc.from('profiles').delete().eq('id',ex.id);
    await svc.auth.admin.deleteUser(ex.id);
  }

  const ownerLogin = await api('/api/auth/login', {method:'POST', body:{identifier:'founder',password:'OwnerSecret123!'}});
  const ownerToken = ownerLogin.body.token;

  const cr = await api('/api/users', {method:'POST', token:ownerToken,
    body:{name:'QA Verify Admin', username:'qa_verify_admin', email:'qa.verify.admin@aceit.test',
      password:'VerifyAdmin2026!', club:'spikers', role:'ADMINS',
      permissions:['news.*','players.*','gallery.*','matches.*','events.*','contact.*','slideshow.*','testimonials.*','stats.*','applications.*']}});
  console.log('Admin created:', cr.ok ? 'OK' : cr.body?.message);
  await new Promise(r=>setTimeout(r,1200));

  const adminLogin = await api('/api/auth/login', {method:'POST', body:{identifier:'qa.verify.admin@aceit.test',password:'VerifyAdmin2026!'}});
  const adminToken = adminLogin.body.token;
  console.log('Admin login:', adminToken ? 'OK' : 'FAILED');

  // FIX 1: Users API with Bearer token
  const usersR = await api('/api/users', { token: adminToken });
  console.log('\nFIX 1 — GET /api/users with Bearer token:', usersR.status, usersR.ok ? 'PASS ✅' : 'FAIL ❌ → '+usersR.body?.message);

  // FIX 2: Announcements CREATE
  const createR = await api('/api/announcements', {method:'POST', token:adminToken,
    body:{title:'VERIFY TEST NOTICE', content:'Verification body text', club:'spikers'}});
  console.log('\nFIX 2a — POST /api/announcements (CREATE):', createR.status, createR.ok ? 'PASS ✅' : 'FAIL ❌ → '+createR.body?.message);

  let announcementId = createR.body?.announcement?.id;
  if (announcementId) {
    // Verify in Supabase
    const { data: dbRow } = await svc.from('announcements').select('*').eq('id', announcementId).maybeSingle();
    console.log('FIX 2b — Supabase verify after CREATE:', dbRow ? 'PASS ✅ title='+dbRow.title : 'FAIL ❌ not found');

    // EDIT
    const editR = await api('/api/announcements?id='+announcementId, {method:'PUT', token:adminToken,
      body:{title:'VERIFY TEST NOTICE EDITED', content:'Verification body text', id:announcementId}});
    console.log('FIX 2c — PUT /api/announcements (EDIT):', editR.status, editR.ok ? 'PASS ✅' : 'FAIL ❌ → '+editR.body?.message);

    // Delete
    const delR = await api('/api/announcements?id='+announcementId, {method:'DELETE', token:adminToken});
    console.log('FIX 2d — DELETE /api/announcements:', delR.status, delR.ok ? 'PASS ✅' : 'FAIL ❌ → '+delR.body?.message);

    // Verify deletion
    const { data: gone } = await svc.from('announcements').select('id').eq('id', announcementId).maybeSingle();
    console.log('FIX 2e — Supabase verify after DELETE:', !gone ? 'PASS ✅ (row gone)' : 'FAIL ❌ row still exists');
  }

  // Cleanup
  const { data: al2 } = await svc.auth.admin.listUsers();
  const qa = (al2?.users||[]).find(u=>u.email==='qa.verify.admin@aceit.test');
  if (qa) {
    await svc.from('club_memberships').delete().eq('user_id',qa.id);
    await svc.from('user_roles').delete().eq('user_id',qa.id);
    await svc.from('profiles').delete().eq('id',qa.id);
    await svc.auth.admin.deleteUser(qa.id);
  }
  await svc.from('announcements').delete().ilike('title','VERIFY%');
  console.log('\nCleaned up. Done.');
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
