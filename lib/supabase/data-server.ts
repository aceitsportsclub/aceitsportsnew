import crypto from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createSupabaseAuthServerClient } from './auth-server';
import { getAuthProfile, type Profile } from './auth-profile';

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return { contentType: match[1], data: Buffer.from(match[2], 'base64') };
}

function extensionFor(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export const CONTENT_TABLES = [
  'players',
  'slideshow',
  'training_sessions',
  'matches',
  'news',
  'gallery',
  'testimonials',
  'sponsors',
  'stats',
  'events'
] as const;

export type ContentTable = (typeof CONTENT_TABLES)[number];

const sourceKeys: Record<ContentTable, string> = {
  players: 'team',
  slideshow: 'slideshow',
  training_sessions: 'training',
  matches: 'matches',
  news: 'news',
  gallery: 'gallery',
  testimonials: 'testimonials',
  sponsors: 'sponsors',
  stats: 'stats',
  events: 'events'
};

function nullable(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSourceToRow(table: ContentTable, item: Record<string, unknown>, clubId: string): { id?: string; [key: string]: unknown } {
  const base: { id?: string; club_id: string } = { club_id: clubId };
  if (isUuid(item.id)) base.id = item.id;

  switch (table) {
    case 'players':
      return { ...base, photo: nullable(item.photo), name: String(item.n ?? item.name ?? '').trim(), jersey_number: nullable(item.num ?? item.no ?? item.jerseyNo), position: nullable(item.pos ?? item.r ?? item.role), category: nullable(Array.isArray(item.cats) ? item.cats.join(', ') : item.cat), height: nullable(item.h), experience: nullable(item.exp), captain: Boolean(item.cap), instagram: nullable(item.insta) };
    case 'slideshow':
      return { ...base, image: nullable(item.image), title: nullable(item.title), date: nullable(item.date), link: nullable(item.link), button_text: nullable(item.btnText ?? item.button_text), sort_order: Number(item.sortOrder ?? item.sort_order ?? 0) };
    case 'training_sessions':
      return { ...base, icon: nullable(item.icon), title: String(item.title ?? '').trim(), time: nullable(item.time), description: nullable(item.desc) };
    case 'matches': {
      let matchDate: string | null = null;
      if (item.date) {
        const parsed = new Date(String(item.date));
        if (!isNaN(parsed.getTime())) {
          matchDate = parsed.toISOString();
        }
      }
      const numScore1 = item.score1 !== null && item.score1 !== undefined && item.score1 !== '' ? Number(item.score1) : null;
      const numScore2 = item.score2 !== null && item.score2 !== undefined && item.score2 !== '' ? Number(item.score2) : null;
      const team1Val = nullable(item.team1) || 'ACEIT Spikers';
      const team2Val = nullable(item.team2 ?? item.opp) || 'Opponent';
      return {
        ...base,
        team1: team1Val,
        team1_logo: nullable(item.team1Logo ?? item.team1_logo),
        team2: team2Val,
        opponent: team2Val,
        team2_logo: nullable(item.team2Logo ?? item.team2_logo),
        date: matchDate,
        venue: nullable(item.venue),
        status: String(item.status || 'upcoming').toLowerCase(),
        score1: Number.isFinite(numScore1) ? numScore1 : null,
        score2: Number.isFinite(numScore2) ? numScore2 : null,
        sets: nullable(item.sets),
        winner: String(item.winner || 'none').toLowerCase(),
        is_live: Boolean(item.isLive ?? item.is_live ?? item.status === 'live')
      };
    }
    case 'news':
      return { ...base, title: String(item.title ?? '').trim(), tag: nullable(item.tag), date: nullable(item.date), body: nullable(item.body), featured: Boolean(item.featured) };
    case 'gallery':
      return {
        ...base,
        media_url: String(item.photo ?? item.mediaUrl ?? item.media_url ?? '').trim(),
        media_type: (item.mediaType === 'video' || item.media_type === 'video') ? 'video' : 'image',
        caption: nullable(item.label ?? item.caption),
        category: nullable(Array.isArray(item.cats) ? item.cats.join(', ') : item.cat),
        card_height: (item.h !== undefined && item.h !== '' && Number.isFinite(Number(item.h))) ? Number(item.h) : null,
        sort_order: (item.sortOrder !== undefined && Number.isFinite(Number(item.sortOrder))) ? Number(item.sortOrder) : 0
      };
    case 'testimonials':
      return { ...base, quote: String(item.q ?? item.quote ?? '').trim(), name: nullable(item.n ?? item.name), role: nullable(item.r ?? item.role) };
    case 'sponsors':
      return { ...base, name: String(item.name ?? '').trim() };
    case 'stats': {
      const parsedTarget = Math.round(Number(item.target ?? 0));
      return { ...base, label: String(item.label ?? '').trim(), target: Number.isFinite(parsedTarget) ? parsedTarget : 0 };
    }
    case 'events':
      return { ...base, poster: nullable(item.poster), title: String(item.title ?? '').trim(), date: nullable(item.date), time: nullable(item.time), venue: nullable(item.venue), description: nullable(item.description), registration_button_text: nullable(item.regBtnText), registration_url: nullable(item.regUrl), registration_enabled: Boolean(item.regEnabled) };
  }
}

function getClubRef(row: Record<string, unknown>): string {
  const clubObj = Array.isArray(row.clubs) ? row.clubs[0] : (row.clubs as Record<string, unknown> | null);
  if (clubObj && typeof clubObj.slug === 'string') return clubObj.slug;
  return String(row.club_id || '');
}

function mapRowToSource(table: ContentTable, row: Record<string, unknown>) {
  const clubRef = getClubRef(row);
  switch (table) {
    case 'players': return { id: row.id, clubId: clubRef, photo: row.photo, n: row.name, num: row.jersey_number, pos: row.position, cat: row.category, cats: typeof row.category === 'string' ? row.category.split(',').map((value) => value.trim()).filter(Boolean) : [], h: row.height, exp: row.experience, cap: row.captain, insta: row.instagram };
    case 'slideshow': return { id: row.id, clubId: clubRef, image: row.image, title: row.title, date: row.date, link: row.link, btnText: row.button_text, sortOrder: row.sort_order };
    case 'training_sessions': return { id: row.id, clubId: clubRef, icon: row.icon, title: row.title, time: row.time, desc: row.description };
    case 'matches': return { id: row.id, clubId: clubRef, team1: row.team1, team1Logo: row.team1_logo, team2: row.team2, opp: row.opponent ?? row.team2, team2Logo: row.team2_logo, date: row.date, venue: row.venue, status: row.status, score1: row.score1, score2: row.score2, sets: row.sets, winner: row.winner, isLive: row.is_live };
    case 'news': return { id: row.id, clubId: clubRef, title: row.title, tag: row.tag, date: row.date, body: row.body, featured: row.featured };
    case 'gallery': return { id: row.id, clubId: clubRef, photo: row.media_url, mediaUrl: row.media_url, mediaType: row.media_type, label: row.caption, caption: row.caption, cat: row.category, cats: typeof row.category === 'string' ? row.category.split(',').map((value) => value.trim()).filter(Boolean) : [], h: row.card_height, sortOrder: row.sort_order };
    case 'testimonials': return { id: row.id, clubId: clubRef, q: row.quote, n: row.name, r: row.role };
    case 'sponsors': return { id: row.id, clubId: clubRef, name: row.name };
    case 'stats': return { id: row.id, clubId: clubRef, label: row.label, target: row.target };
    case 'events': return { id: row.id, clubId: clubRef, poster: row.poster, title: row.title, date: row.date, time: row.time, venue: row.venue, description: row.description, regBtnText: row.registration_button_text, regUrl: row.registration_url, regEnabled: row.registration_enabled };
  }
}

async function requireUser(request?: Request) {
  const serverClient = await createSupabaseAuthServerClient();
  const authHeader = request?.headers.get('authorization') || request?.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : undefined;

  let user: User | null = null;
  let activeClient: SupabaseClient = serverClient;

  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
    if (url && key) {
      activeClient = createClient(url, key, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      });
      const { data: userData } = await activeClient.auth.getUser(token);
      user = userData?.user ?? null;
    }
  }

  if (!user) {
    const { data: authData, error } = await serverClient.auth.getUser();
    if (error || !authData.user) throw new Error('UNAUTHENTICATED');
    user = authData.user;
    activeClient = serverClient;
  }

  const profile = await getAuthProfile(activeClient, user);
  return { supabase: activeClient, profile };
}

async function resolveClubId(supabase: SupabaseClient, clubRef: string): Promise<string> {
  const cleanRef = (clubRef || '').trim();
  if (!cleanRef) throw new Error('CLUB_REQUIRED');

  if (isUuid(cleanRef)) {
    const byId = await supabase.from('clubs').select('id').eq('id', cleanRef).maybeSingle();
    if (byId.data?.id) return byId.data.id;
  }
  const bySlug = await supabase.from('clubs').select('id').eq('slug', cleanRef.toLowerCase()).maybeSingle();
  if (bySlug.data?.id) return bySlug.data.id;
  throw new Error('CLUB_NOT_FOUND');
}

export async function readContent(clubId: string, client?: SupabaseClient, section?: string | { section?: string }) {
  const supabase = client || await createSupabaseAuthServerClient();
  const cleanRef = (clubId || '').trim().toLowerCase();
  const isAll = cleanRef === 'all';
  let resolvedClubId: string | null = null;

  if (!isAll) {
    resolvedClubId = await resolveClubId(supabase, cleanRef);
  }

  const result: Record<string, unknown> = {
    training: [],
    team: [],
    gallery: [],
    matches: [],
    news: [],
    sponsors: [],
    testimonials: [],
    events: [],
    stats: [],
    slideshow: [],
    categories: { team: [], gallery: [] },
    deletedCategories: { team: [], gallery: [] },
    customCategories: { team: [], gallery: [] },
    about: {},
    contact: {},
    applications: []
  };

  const rawSection = typeof section === 'object' && section !== null ? section.section : section;
  const cleanSection = typeof rawSection === 'string' && rawSection.trim() ? rawSection.trim().toLowerCase() : undefined;

  let tablesToQuery: ContentTable[] = [];
  if (!cleanSection) {
    tablesToQuery = [...CONTENT_TABLES];
  } else if (cleanSection === 'players' || cleanSection === 'team') {
    tablesToQuery = ['players'];
  } else if (cleanSection === 'gallery') {
    tablesToQuery = ['gallery'];
  } else if (cleanSection === 'matches') {
    tablesToQuery = ['matches'];
  } else if (cleanSection === 'events') {
    tablesToQuery = ['events'];
  } else if (cleanSection === 'notice-board' || cleanSection === 'news') {
    tablesToQuery = ['news'];
  } else if (cleanSection === 'home') {
    tablesToQuery = ['slideshow', 'sponsors', 'testimonials', 'stats', 'training_sessions'];
  } else {
    tablesToQuery = [...CONTENT_TABLES];
  }

  for (const table of tablesToQuery) {
    const orderBy = (table === 'slideshow' || table === 'gallery') ? 'sort_order' : 'created_at';
    let query = supabase.from(table).select('*, clubs(slug)');
    if (resolvedClubId) {
      query = query.eq('club_id', resolvedClubId);
    }
    const { data, error } = await query.order(orderBy, { ascending: true });
    if (error) throw error;
    result[sourceKeys[table]] = (data ?? []).map((row) => mapRowToSource(table, row));
  }

  const needCategories = !cleanSection || cleanSection === 'players' || cleanSection === 'team' || cleanSection === 'gallery';
  const needAbout = !cleanSection || cleanSection === 'home' || cleanSection === 'about';
  const needContact = !cleanSection || cleanSection === 'home' || cleanSection === 'contact';
  const needApplications = !cleanSection;

  if (resolvedClubId) {
    const aboutPromise = needAbout
      ? supabase.from('club_about').select('*').eq('club_id', resolvedClubId).maybeSingle()
      : Promise.resolve({ data: null });

    const contactPromise = needContact
      ? supabase.from('club_contact').select('*').eq('club_id', resolvedClubId).maybeSingle()
      : Promise.resolve({ data: null });

    const contactButtonsPromise = needContact
      ? supabase.from('club_contact_buttons').select('*').eq('club_id', resolvedClubId).order('sort_order', { ascending: true })
      : Promise.resolve({ data: null });

    const categoriesPromise = needCategories
      ? supabase.from('custom_categories').select('*').eq('club_id', resolvedClubId)
      : Promise.resolve({ data: null });

    const [{ data: about }, { data: contact }, { data: contactButtons }, { data: categories }] = await Promise.all([
      aboutPromise,
      contactPromise,
      contactButtonsPromise,
      categoriesPromise
    ]) as [{ data: Record<string, unknown> | null }, { data: Record<string, unknown> | null }, { data: Array<{ id: string; label: string; url: string; sort_order: number }> | null }, { data: Array<{ name: string; section: string; active?: boolean }> | null }];

    if (needAbout) {
      result.about = about ?? {};
    }

    if (needContact) {
      const buttons = (contactButtons ?? []).map((b) => ({
        id: b.id,
        label: b.label,
        url: b.url,
        sort_order: b.sort_order
      }));
      const firstInsta = buttons.find((b) => /instagram/i.test(b.label) || /instagram/i.test(b.url));

      result.contact = {
        ...(contact ?? {}),
        socialButtons: buttons,
        insta: firstInsta ? firstInsta.url : (buttons[0]?.url || 'https://instagram.com/aceit_jaipur')
      };
    }

    if (needCategories) {
      const isOrderRow = (row: { name?: string }) => typeof row?.name === 'string' && row.name.startsWith('__player_order__:');

      result.deletedCategories = {
        team: (categories ?? []).filter((row) => row.section === 'team' && row.active === false && !isOrderRow(row)).map((row) => row.name),
        gallery: (categories ?? []).filter((row) => row.section === 'gallery' && row.active === false && !isOrderRow(row)).map((row) => row.name)
      };
      result.customCategories = {
        team: (categories ?? []).filter((row) => row.section === 'team' && row.active !== false && !isOrderRow(row)).map((row) => row.name),
        gallery: (categories ?? []).filter((row) => row.section === 'gallery' && row.active !== false && !isOrderRow(row)).map((row) => row.name)
      };
      result.categories = {
        team: (categories ?? []).filter((row) => row.section === 'team' && row.active !== false && !isOrderRow(row)).map((row) => row.name),
        gallery: (categories ?? []).filter((row) => row.section === 'gallery' && row.active !== false && !isOrderRow(row)).map((row) => row.name)
      };

      const playerOrderRecord = (categories ?? []).find((row) => row.section === 'team' && isOrderRow(row));
      if (playerOrderRecord?.name && Array.isArray(result.team)) {
        let orderedIds: string[] = [];
        try {
          const raw = playerOrderRecord.name.substring('__player_order__:'.length);
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) orderedIds = parsed.map(String);
        } catch {
          // ignore parse errors
        }

        if (orderedIds.length > 0) {
          const idMap = new Map<string, number>();
          orderedIds.forEach((id, idx) => idMap.set(id, idx));

          result.team.sort((a, b) => {
            const aId = String((a as { id?: unknown })?.id || '');
            const bId = String((b as { id?: unknown })?.id || '');
            const aPos = idMap.has(aId) ? idMap.get(aId)! : -1;
            const bPos = idMap.has(bId) ? idMap.get(bId)! : -1;

            if (aPos === -1 && bPos === -1) return 0;
            if (aPos === -1) return 1;
            if (bPos === -1) return -1;
            return aPos - bPos;
          });
        }
      }
    }
  }

  if (needApplications) {
    let appsQuery = supabase.from('applications').select('*, clubs(id, slug, name)');
    if (resolvedClubId) {
      appsQuery = appsQuery.eq('club_id', resolvedClubId);
    }
    const { data: appsData } = await appsQuery.order('created_at', { ascending: false });
    result.applications = (appsData ?? []).map((row) => {
      const clubObj = Array.isArray(row.clubs) ? row.clubs[0] : (row.clubs as Record<string, unknown> | null);
      const clubSlug = (clubObj?.slug as string) || 'spikers';
      const createdAt = (row.created_at as string) || new Date().toISOString();
      return {
        id: row.id,
        _id: row.id,
        clubId: row.club_id,
        club_id: row.club_id,
        clubSlug,
        club: clubSlug,
        userId: row.user_id || null,
        user_id: row.user_id || null,
        name: row.name,
        email: row.email,
        phone: row.phone || '',
        position: row.position || '',
        experience: row.experience || '',
        message: row.message || '',
        source: row.source || 'Website Form',
        status: row.status || 'Pending',
        date: createdAt,
        createdAt,
        created_at: createdAt,
        updatedAt: row.updated_at || createdAt,
        updated_at: row.updated_at || createdAt
      };
    });
  }

  return result;
}

const moduleToTable: Record<string, ContentTable> = {
  players: 'players',
  team: 'players',
  slideshow: 'slideshow',
  matches: 'matches',
  news: 'news',
  announcements: 'news',
  notice: 'news',
  gallery: 'gallery',
  training: 'training_sessions',
  training_sessions: 'training_sessions',
  testimonials: 'testimonials',
  sponsors: 'sponsors',
  stats: 'stats',
  events: 'events'
};

async function syncSingleClub(
  resolvedClubId: string,
  clubSlug: string,
  payload: Record<string, unknown>,
  writeClient: SupabaseClient,
  profile: Profile,
  saveModule?: string,
  isGlobalSync: boolean = false,
  allClubs?: { id: string; slug: string }[]
) {
  // Verify module-level permission for non-owner
  if (profile.role !== 'OWNER') {
    const targetModule = saveModule ? saveModule.toLowerCase().trim() : undefined;
    if (targetModule) {
      const permKey = targetModule === 'team' ? 'players' : (targetModule === 'training_sessions' ? 'training' : (targetModule === 'announcements' || targetModule === 'notice' ? 'news' : targetModule));
      const userPerms = profile.permissions || [];
      const hasPerm = userPerms.includes('*') ||
        userPerms.includes(`${permKey}.*`) ||
        userPerms.includes(`${permKey}.edit`) ||
        userPerms.includes(`${permKey}.write`) ||
        userPerms.includes(`${permKey}.manage`) ||
        userPerms.includes(permKey);
      if (!hasPerm) {
        throw new Error(`FORBIDDEN: You do not have permission to manage ${targetModule}.`);
      }
    }
  }

  const explicitTargetTable = saveModule ? moduleToTable[saveModule.toLowerCase().trim()] : undefined;

  let targetTables: ContentTable[] = [];
  if (explicitTargetTable) {
    targetTables = [explicitTargetTable];
  } else if (saveModule) {
    targetTables = [];
  } else {
    for (const table of CONTENT_TABLES) {
      const sourceKey = sourceKeys[table];
      const hasKey = Object.prototype.hasOwnProperty.call(payload, sourceKey) || Object.prototype.hasOwnProperty.call(payload, table);
      if (!hasKey) continue;
      const rawItems = payload[sourceKey] ?? payload[table];
      const items = Array.isArray(rawItems) ? rawItems as Record<string, unknown>[] : [];

      const { data: existingRows, error: existingError } = await writeClient.from(table).select('*').eq('club_id', resolvedClubId);
      if (existingError) throw existingError;
      const existing = existingRows ?? [];

      const filteredForDiff = items.filter((item) => {
        if (!item || typeof item !== 'object') return false;
        const itemClub = String(item.clubId || item.club_id || '').toLowerCase().trim();
        if (!itemClub) {
          return isGlobalSync ? (clubSlug === 'spikers' || (allClubs && allClubs[0]?.slug === clubSlug)) : true;
        }
        return itemClub === clubSlug || itemClub === resolvedClubId;
      });

      if (filteredForDiff.length !== existing.length) {
        targetTables.push(table);
        continue;
      }
      if (filteredForDiff.some((it) => !isUuid(it.id))) {
        targetTables.push(table);
        continue;
      }
      const hasBase64 = filteredForDiff.some((it) => {
        const media = typeof it.photo === 'string' ? it.photo : (typeof it.mediaUrl === 'string' ? it.mediaUrl : (typeof it.image === 'string' ? it.image : ''));
        return media.startsWith('data:');
      });
      if (hasBase64) {
        targetTables.push(table);
        continue;
      }
      const itemIds = new Set(filteredForDiff.map((it) => String(it.id)));
      if (existing.some((row) => !itemIds.has(String(row.id)))) {
        targetTables.push(table);
        continue;
      }
      const existingMap = new Map(existing.map((row) => [String(row.id), row]));
      let hasFieldChange = false;
      for (const item of filteredForDiff) {
        const oldRow = existingMap.get(String(item.id));
        if (!oldRow) {
          hasFieldChange = true;
          break;
        }
        const newRow = mapSourceToRow(table, item, resolvedClubId);
        for (const [key, val] of Object.entries(newRow)) {
          if (key === 'id' || key === 'club_id' || key === 'created_at' || key === 'updated_at') continue;
          const oldVal = oldRow[key];
          const nVal = val === undefined || val === '' ? null : val;
          const oVal = oldVal === undefined || oldVal === '' ? null : oldVal;
          if (nVal !== oVal) {
            hasFieldChange = true;
            break;
          }
        }
        if (hasFieldChange) break;
      }
      if (hasFieldChange) {
        targetTables.push(table);
      }
    }
  }

  // Verify module-level permission for non-owner across all target tables
  if (profile.role !== 'OWNER') {
    const userPerms = profile.permissions || [];
    const hasModulePerm = (moduleName: string) => {
      const permKey = moduleName === 'team' ? 'players' : (moduleName === 'training_sessions' ? 'training' : (moduleName === 'announcements' || moduleName === 'notice' ? 'news' : moduleName));
      return userPerms.includes('*') ||
        userPerms.includes(`${permKey}.*`) ||
        userPerms.includes(`${permKey}.edit`) ||
        userPerms.includes(`${permKey}.write`) ||
        userPerms.includes(`${permKey}.manage`) ||
        userPerms.includes(permKey);
    };

    const targetModule = saveModule ? saveModule.toLowerCase().trim() : undefined;
    if (targetModule) {
      if (!hasModulePerm(targetModule)) {
        throw new Error(`FORBIDDEN: You do not have permission to manage ${targetModule}.`);
      }
    } else {
      for (const table of targetTables) {
        if (!hasModulePerm(table)) {
          throw new Error(`FORBIDDEN: You do not have permission to manage ${table}.`);
        }
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'contact')) {
        if (!hasModulePerm('contact')) {
          throw new Error(`FORBIDDEN: You do not have permission to manage contact.`);
        }
      }
    }
  }

  for (const table of targetTables) {
    const sourceKey = sourceKeys[table];
    const rawItems = payload[sourceKey] ?? payload[table];
    if (!rawItems) continue;
    const items = Array.isArray(rawItems) ? rawItems as Record<string, unknown>[] : [];

    const filteredItems = items.filter((item) => {
      if (!item || typeof item !== 'object') return false;
      const itemClub = String(item.clubId || item.club_id || '').toLowerCase().trim();
      if (!itemClub) {
        return isGlobalSync ? (clubSlug === 'spikers' || (allClubs && allClubs[0]?.slug === clubSlug)) : true;
      }
      return itemClub === clubSlug || itemClub === resolvedClubId;
    });

    const rows = filteredItems.map((item, index) => {
      const row = mapSourceToRow(table, item, resolvedClubId);
      if (table === 'slideshow' || table === 'gallery') {
        row.sort_order = index;
      }
      return row;
    }).map((row) => {
      if (isUuid(row.id)) return row;
      const { id: _ignoredId, ...rowWithoutId } = row;
      return rowWithoutId;
    });

    // For gallery items: ensure media_url is stored in Supabase 'gallery-media' bucket
    if (table === 'gallery') {
      const { data: currentDbGallery } = await writeClient.from('gallery').select('id, media_url').eq('club_id', resolvedClubId);
      const existingMediaMap = new Map((currentDbGallery || []).map((r) => [String(r.id), r.media_url]));

      for (const row of rows) {
        let mediaUrl = typeof row.media_url === 'string' ? row.media_url.trim() : '';
        if (!mediaUrl && row.id && existingMediaMap.has(String(row.id))) {
          mediaUrl = existingMediaMap.get(String(row.id)) || '';
          row.media_url = mediaUrl;
        }

        if (mediaUrl.startsWith('data:')) {
          const parsed = parseDataUrl(mediaUrl);
          if (parsed) {
            const ext = extensionFor(parsed.contentType);
            const path = `${clubSlug}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await writeClient.storage
              .from('gallery-media')
              .upload(path, parsed.data, { contentType: parsed.contentType, upsert: false });
            if (uploadError) {
              console.error('[gallery storage upload error]', uploadError);
              throw uploadError;
            }
            const { data: pubData } = writeClient.storage.from('gallery-media').getPublicUrl(path);
            row.media_url = pubData.publicUrl;
          }
        } else if (mediaUrl.includes('/player-photos/')) {
          const oldPath = mediaUrl.split('/player-photos/')[1]?.split('?')[0];
          if (oldPath) {
            const ext = oldPath.split('.').pop() || 'jpg';
            const newPath = `${clubSlug}/${crypto.randomUUID()}.${ext}`;
            const { data: fileData, error: downloadError } = await writeClient.storage.from('player-photos').download(oldPath);
            if (!downloadError && fileData) {
              const buffer = Buffer.from(await fileData.arrayBuffer());
              const { error: copyError } = await writeClient.storage.from('gallery-media').upload(newPath, buffer, {
                contentType: fileData.type || 'image/jpeg',
                upsert: false
              });
              if (!copyError) {
                const { data: pubData } = writeClient.storage.from('gallery-media').getPublicUrl(newPath);
                row.media_url = pubData.publicUrl;
              }
            }
          }
        }
      }
    }

    // For event items: ensure poster is stored in Supabase 'event-posters' bucket
    if (table === 'events') {
      const { data: currentDbEvents } = await writeClient.from('events').select('id, poster').eq('club_id', resolvedClubId);
      const existingPosterMap = new Map((currentDbEvents || []).map((r) => [String(r.id), r.poster]));

      for (const row of rows) {
        let poster = typeof row.poster === 'string' ? row.poster.trim() : '';
        if (!poster && row.id && existingPosterMap.has(String(row.id))) {
          poster = existingPosterMap.get(String(row.id)) || '';
          row.poster = poster || null;
        }

        if (poster.startsWith('data:')) {
          const parsed = parseDataUrl(poster);
          if (parsed) {
            const ext = extensionFor(parsed.contentType);
            const path = `${clubSlug}/${crypto.randomUUID()}.${ext}`;
            const { error: uploadError } = await writeClient.storage
              .from('event-posters')
              .upload(path, parsed.data, { contentType: parsed.contentType, upsert: false });
            if (uploadError) {
              console.error('[event poster storage upload error]', uploadError);
              throw uploadError;
            }
            const { data: pubData } = writeClient.storage.from('event-posters').getPublicUrl(path);
            row.poster = pubData.publicUrl;
          }
        } else if (poster.includes('/player-photos/')) {
          const oldPath = poster.split('/player-photos/')[1]?.split('?')[0];
          if (oldPath) {
            const ext = oldPath.split('.').pop() || 'jpg';
            const newPath = `${clubSlug}/${crypto.randomUUID()}.${ext}`;
            const { data: fileData, error: downloadError } = await writeClient.storage.from('player-photos').download(oldPath);
            if (!downloadError && fileData) {
              const buffer = Buffer.from(await fileData.arrayBuffer());
              const { error: copyError } = await writeClient.storage.from('event-posters').upload(newPath, buffer, {
                contentType: fileData.type || 'image/jpeg',
                upsert: false
              });
              if (!copyError) {
                const { data: pubData } = writeClient.storage.from('event-posters').getPublicUrl(newPath);
                row.poster = pubData.publicUrl;
              }
            }
          }
        }
      }
    }

    const invalid = rows.find((row) => {
      switch (table) {
        case 'players': return !row.name;
        case 'training_sessions': return !row.title;
        case 'matches': return !row.team1;
        case 'news': return !row.title;
        case 'gallery': return !row.media_url;
        case 'testimonials': return !row.quote;
        case 'sponsors': return !row.name;
        case 'stats': return !row.label;
        case 'events': return !row.title;
        default: return false;
      }
    });
    if (invalid) throw new Error(`INVALID_${sourceKey.toUpperCase()}`);

    const { data: existing, error: existingError } = await writeClient.from(table).select('id').eq('club_id', resolvedClubId);
    if (existingError) throw existingError;

    let insertedRowsData: { id?: string }[] = [];
    if (rows.length) {
      const existingRows = rows.filter((row) => isUuid(row.id));
      const newRows = rows.filter((row) => !Object.prototype.hasOwnProperty.call(row, 'id'));
      if (existingRows.length) {
        const { error } = await writeClient.from(table).upsert(existingRows, { onConflict: 'id' });
        if (error) throw error;
      }
      if (newRows.length) {
        const { data: insertedNew, error } = await writeClient.from(table).insert(newRows).select('id');
        if (error) throw error;
        insertedRowsData = (insertedNew as { id?: string }[]) || [];
      }
    }

    if (table === 'players' && filteredItems.length > 0) {
      const finalOrderedIds: string[] = [];
      let newIdx = 0;
      for (const item of filteredItems) {
        if (isUuid(item.id)) {
          finalOrderedIds.push(item.id);
        } else if (insertedRowsData[newIdx]?.id) {
          finalOrderedIds.push(insertedRowsData[newIdx].id!);
          newIdx++;
        }
      }

      if (finalOrderedIds.length > 0) {
        const orderName = '__player_order__:' + JSON.stringify(finalOrderedIds);
        const { data: existingOrders } = await writeClient
          .from('custom_categories')
          .select('id')
          .eq('club_id', resolvedClubId)
          .eq('section', 'team')
          .like('name', '__player_order__:%');

        if (existingOrders && existingOrders.length > 0) {
          const [first, ...rest] = existingOrders;
          await writeClient
            .from('custom_categories')
            .update({
              name: orderName,
              active: false,
              updated_at: new Date().toISOString()
            })
            .eq('id', first.id);
          if (rest.length > 0) {
            await writeClient.from('custom_categories').delete().in('id', rest.map((r) => r.id));
          }
        } else {
          await writeClient
            .from('custom_categories')
            .insert({
              club_id: resolvedClubId,
              section: 'team',
              name: orderName,
              active: false
            });
        }
      }
    }

    const ids = rows.filter((row) => isUuid(row.id)).map((row) => row.id as string);
    const removed = (existing ?? []).map((row) => row.id).filter((id) => !ids.includes(id));
    if (removed.length) {
      const { error } = await writeClient.from(table).delete().eq('club_id', resolvedClubId).in('id', removed);
      if (error) throw error;
    }
  }

  const rawClubRef = typeof payload.clubId === 'string' ? payload.clubId.trim().toLowerCase() : '';
  const shouldSyncContact = !isGlobalSync || (rawClubRef === clubSlug || rawClubRef === resolvedClubId || (!rawClubRef && clubSlug === 'spikers'));
  if (shouldSyncContact && (saveModule?.toLowerCase().trim() === 'contact' || (!saveModule && Object.prototype.hasOwnProperty.call(payload, 'contact')))) {
    const rawContact = (payload.contact && typeof payload.contact === 'object') ? (payload.contact as Record<string, unknown>) : {};

    const contactRow = {
      club_id: resolvedClubId,
      address: nullable(rawContact.address),
      email: nullable(rawContact.email),
      phone: nullable(rawContact.phone),
      hours: nullable(rawContact.hours),
      updated_at: new Date().toISOString()
    };

    const { error: contactError } = await writeClient
      .from('club_contact')
      .upsert(contactRow, { onConflict: 'club_id' });
    if (contactError) throw contactError;

    const rawButtons = Array.isArray(rawContact.socialButtons)
      ? (rawContact.socialButtons as Record<string, unknown>[])
      : (Array.isArray(rawContact.buttons) ? (rawContact.buttons as Record<string, unknown>[]) : []);

    const buttonRows = rawButtons.map((btn, index) => {
      const bRow: { id?: string; club_id: string; label: string; url: string; sort_order: number; updated_at: string } = {
        club_id: resolvedClubId,
        label: String(btn.label ?? btn.text ?? 'Link').trim() || 'Link',
        url: String(btn.url ?? btn.link ?? '#').trim() || '#',
        sort_order: typeof btn.sort_order === 'number' ? btn.sort_order : index,
        updated_at: new Date().toISOString()
      };
      if (isUuid(btn.id)) {
        bRow.id = btn.id as string;
      }
      return bRow;
    });

    const { error: delBtnError } = await writeClient
      .from('club_contact_buttons')
      .delete()
      .eq('club_id', resolvedClubId);
    if (delBtnError) throw delBtnError;

    if (buttonRows.length) {
      const rowsToInsert = buttonRows.map((r) => {
        if (isUuid(r.id)) return r;
        const { id: _ignored, ...rest } = r;
        return rest;
      });
      const { error: insBtnError } = await writeClient
        .from('club_contact_buttons')
        .insert(rowsToInsert);
      if (insBtnError) throw insBtnError;
    }
  }

  const shouldSyncAbout = !isGlobalSync || (rawClubRef === clubSlug || rawClubRef === resolvedClubId || (!rawClubRef && clubSlug === 'spikers'));
  if (shouldSyncAbout && (saveModule?.toLowerCase().trim() === 'about' || (!saveModule && Object.prototype.hasOwnProperty.call(payload, 'about')))) {
    const rawAbout = (payload.about && typeof payload.about === 'object') ? (payload.about as Record<string, unknown>) : {};
    const aboutRow = {
      club_id: resolvedClubId,
      eyebrow: nullable(rawAbout.eyebrow),
      title: nullable(rawAbout.title),
      sub: nullable(rawAbout.sub),
      mission: nullable(rawAbout.mission),
      vision: nullable(rawAbout.vision),
      updated_at: new Date().toISOString()
    };

    const { error: aboutError } = await writeClient
      .from('club_about')
      .upsert(aboutRow, { onConflict: 'club_id' });
    if (aboutError) throw aboutError;
  }

  // Handle custom_categories and deletedCategories synchronization per club_id
  if (!isGlobalSync || clubSlug === 'spikers') {
    const rawCustomCats = (payload.customCategories && typeof payload.customCategories === 'object')
      ? (payload.customCategories as Record<string, unknown>)
      : null;
    const rawDeletedCats = (payload.deletedCategories && typeof payload.deletedCategories === 'object')
      ? (payload.deletedCategories as Record<string, unknown>)
      : null;

    if (rawCustomCats || rawDeletedCats) {
      for (const section of ['team', 'gallery'] as const) {
        const catNames = rawCustomCats && Array.isArray(rawCustomCats[section])
          ? [...new Set(
              (rawCustomCats[section] as unknown[])
                .map((n) => String(n || '').trim().toLowerCase())
                .filter(Boolean)
            )]
          : null;

        const deletedNames = rawDeletedCats && Array.isArray(rawDeletedCats[section])
          ? [...new Set(
              (rawDeletedCats[section] as unknown[])
                .map((n) => String(n || '').trim().toLowerCase())
                .filter(Boolean)
            )]
          : null;

        if (catNames && catNames.length > 0) {
          for (const name of catNames) {
            await writeClient.from('custom_categories').upsert({
              club_id: resolvedClubId,
              section,
              name,
              active: true,
              updated_at: new Date().toISOString()
            }, { onConflict: 'club_id,section,name' });
          }
        }

        if (deletedNames && deletedNames.length > 0) {
          for (const name of deletedNames) {
            if (!catNames || !catNames.includes(name)) {
              await writeClient.from('custom_categories').upsert({
                club_id: resolvedClubId,
                section,
                name,
                active: false,
                updated_at: new Date().toISOString()
              }, { onConflict: 'club_id,section,name' });
            }
          }
        }
      }
    }
  }
}

export async function syncContent(
  clubId: string,
  payload: Record<string, unknown>,
  requestOrProfile?: Request | Profile,
  saveModule?: string
) {
  let supabase: SupabaseClient;
  let profile: Profile;

  if (requestOrProfile && typeof requestOrProfile === 'object' && 'role' in requestOrProfile && 'id' in requestOrProfile) {
    profile = requestOrProfile as Profile;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    supabase = (serviceKey && url)
      ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
      : await createSupabaseAuthServerClient();
  } else {
    const auth = await requireUser(requestOrProfile as Request | undefined);
    supabase = auth.supabase;
    profile = auth.profile;
  }

  const requestedClubId = (clubId || '').trim().toLowerCase();
  if (!requestedClubId) {
    throw new Error('CLUB_REQUIRED');
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const writeClient: SupabaseClient = (serviceKey && url)
    ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    : supabase;

  if (requestedClubId === 'all') {
    if (profile.role !== 'OWNER') {
      throw new Error('FORBIDDEN');
    }
    const { data: allClubsRows, error: clubsError } = await writeClient.from('clubs').select('id, slug');
    if (clubsError) throw clubsError;
    const allClubs = allClubsRows || [];
    if (allClubs.length === 0) throw new Error('NO_CLUBS_FOUND');

    for (const club of allClubs) {
      await syncSingleClub(club.id, club.slug, payload, writeClient, profile, saveModule, true, allClubs);
    }
    return readContent('all', writeClient);
  }

  const resolvedClubId = await resolveClubId(supabase, requestedClubId);
  const isAuthorized = profile.role === 'OWNER' || profile.clubs.includes(resolvedClubId) || profile.clubs.includes(requestedClubId);
  if (!isAuthorized) throw new Error('FORBIDDEN');

  const { data: clubData } = await writeClient.from('clubs').select('id, slug').eq('id', resolvedClubId).maybeSingle();
  const clubSlug = clubData?.slug || 'spikers';

  await syncSingleClub(resolvedClubId, clubSlug, payload, writeClient, profile, saveModule, false);
  return readContent(resolvedClubId, writeClient);
}

export { sourceKeys };
