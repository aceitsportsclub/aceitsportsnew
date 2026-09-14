/**
 * Final trace: test the exact insert that happens in the announcements route
 * using anon+bearer client (same as the API route does) with a real admin
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
  // Setup: get owner token and create temp admin
  const { data: al } = await svc.auth.admin.listUsers();
  const ex = (al?.users||[]).find(u=>u.email==='qa.ins.admin@aceit.test');
  if (ex) {
    await svc.from('club_memberships').delete().eq('user_id',ex.id);
    await svc.from('user_roles').delete().eq('user_id',ex.id);
    await svc.from('profiles').delete().eq('id',ex.id);
    await svc.auth.admin.deleteUser(ex.id);
  }

  const ownerLogin = await api('/api/auth/login', {method:'POST', body:{identifier:'founder',password:'OwnerSecret123!'}});
  const ownerToken = ownerLogin.body.token;

  await api('/api/users', {method:'POST', token:ownerToken,
    body:{name:'QA Ins Admin', username:'qa_ins_admin', email:'qa.ins.admin@aceit.test',
      password:'InsAdmin2026!', club:'spikers', role:'ADMINS',
      permissions:['news.*','players.*']}});
  await new Promise(r=>setTimeout(r,1200));

  const adminLogin = await api('/api/auth/login', {method:'POST', body:{identifier:'qa.ins.admin@aceit.test',password:'InsAdmin2026!'}});
  const adminToken = adminLogin.body.token;

  // Build anon+bearer client (same as route does)
  const anonClient = createClient(sbUrl, sbAnon, {
    global: { headers: { Authorization: `Bearer ${adminToken}` } }
  });
  const { data: userData } = await anonClient.auth.getUser(adminToken);
  const userId = userData?.user?.id;
  console.log('Admin userId:', userId);

  const { data: spikersClub } = await anonClient.from('clubs').select('id').eq('slug','spikers').maybeSingle();
  const clubId = spikersClub?.id;
  console.log('Spikers club_id:', clubId);

  // Exact insert from announcements route (line 94-105)
  console.log('\nAttempting exact insert from route code...');
  const { data: insertData, error: insertError } = await anonClient
    .from('announcements')
    .insert({
      club_id: clubId,
      title: 'INSERT TRACE TEST',
      category: null,
      content: 'INSERT TRACE BODY',
      is_pinned: false,
      created_by: userId
    })
    .select('*, clubs(id, slug, name)')
    .single();

  if (insertError) {
    console.log('INSERT ERROR:');
    console.log('  message:', insertError.message);
    console.log('  code:', insertError.code);
    console.log('  details:', insertError.details);
    console.log('  hint:', insertError.hint);
    console.log('  full:', JSON.stringify(insertError));
  } else {
    console.log('INSERT SUCCESS! id=', insertData?.id);
    // cleanup
    await svc.from('announcements').delete().eq('id', insertData.id);
    console.log('(cleaned up)');
  }

  // Also test: what if category is undefined (not null)?
  console.log('\nAttempting insert with category=undefined...');
  const { data: d2, error: e2 } = await anonClient
    .from('announcements')
    .insert({
      club_id: clubId,
      title: 'INSERT TRACE TEST 2',
      content: 'INSERT TRACE BODY 2',
      is_pinned: false,
      created_by: userId
      // no category field at all
    })
    .select('*, clubs(id, slug, name)')
    .single();
  console.log(e2 ? 'ERROR: '+ JSON.stringify({msg: e2.message, code: e2.code}) : 'SUCCESS id='+d2?.id);
  if (d2?.id) { await svc.from('announcements').delete().eq('id',d2.id); }

  // Cleanup
  const { data: al2 } = await svc.auth.admin.listUsers();
  const qa = (al2?.users||[]).find(u=>u.email==='qa.ins.admin@aceit.test');
  if (qa) {
    await svc.from('club_memberships').delete().eq('user_id',qa.id);
    await svc.from('user_roles').delete().eq('user_id',qa.id);
    await svc.from('profiles').delete().eq('id',qa.id);
    await svc.auth.admin.deleteUser(qa.id);
    console.log('\nCleaned up.');
  }
}
run().catch(e => { console.error('CRASH:', e); process.exit(1); });
