/**
 * Trace exact error in POST /api/announcements for an admin with news.* permission
 * clubs returned include UUID alongside slug — test both
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
  const { data: authList } = await svc.auth.admin.listUsers();
  const existing = (authList?.users||[]).find(u=>u.email==='qa.trace.admin@aceit.test');
  if (existing) {
    await svc.from('club_memberships').delete().eq('user_id', existing.id);
    await svc.from('user_roles').delete().eq('user_id', existing.id);
    await svc.from('profiles').delete().eq('id', existing.id);
    await svc.auth.admin.deleteUser(existing.id);
  }

  const ownerToken = await login('founder','OwnerSecret123!');
  await api('/api/users', { method:'POST', token:ownerToken,
    body:{ name:'QA Trace Admin', username:'qa_trace_admin', email:'qa.trace.admin@aceit.test',
      password:'TraceAdmin2026!', club:'spikers', role:'ADMINS',
      permissions:['news.*','players.*','gallery.*','matches.*','events.*','contact.*','slideshow.*','testimonials.*','stats.*','applications.*'] }
  });
  await new Promise(r=>setTimeout(r,1500));

  const adminToken = await login('qa.trace.admin@aceit.test','TraceAdmin2026!');
  const meR = await api('/api/auth/me', { token: adminToken });
  const profile = meR.body?.user || meR.body?.profile || {};
  console.log('Admin clubs:', JSON.stringify(profile.clubs));
  console.log('Admin clubId:', profile.clubId);

  // Try every variation of the club field to see which resolves
  const variants = [
    { club:'spikers' },
    { clubId:'spikers' },
    { club_id:'spikers' },
    { club: profile.clubs?.[0] },
    { clubId: profile.clubs?.[0] },
    { club: profile.clubs?.[1] },
    { clubId: profile.clubs?.[1] },
    { club: profile.clubId },
  ];

  for (const v of variants) {
    const r = await api('/api/announcements', { method:'POST', token:adminToken,
      body:{ title:'TRACE TEST', content:'TRACE BODY', ...v }});
    console.log(`  ${JSON.stringify(v)} → ${r.status} ${r.ok ? 'SUCCESS id='+r.body?.announcement?.id : r.body?.message}`);
    if (r.ok && r.body?.announcement?.id) {
      await svc.from('announcements').delete().eq('id', r.body.announcement.id);
      break;
    }
  }

  // Now check assertCanManageClub logic
  // profile.clubs includes both slugs and UUIDs — which format does assertCanManageClub check?
  const { data: spikersClub } = await svc.from('clubs').select('id,slug').eq('slug','spikers').maybeSingle();
  console.log('\nSpikers club_id (UUID):', spikersClub?.id);
  console.log('Does profile.clubs include UUID?', profile.clubs?.includes(spikersClub?.id));
  console.log('Does profile.clubs include slug?', profile.clubs?.includes('spikers'));

  // Cleanup
  const { data: al2 } = await svc.auth.admin.listUsers();
  const qa = (al2?.users||[]).find(u=>u.email==='qa.trace.admin@aceit.test');
  if (qa) {
    await svc.from('club_memberships').delete().eq('user_id', qa.id);
    await svc.from('user_roles').delete().eq('user_id', qa.id);
    await svc.from('profiles').delete().eq('id', qa.id);
    await svc.auth.admin.deleteUser(qa.id);
  }
  await svc.from('announcements').delete().ilike('title','TRACE%');
  console.log('Cleaned up.');
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
