begin;

create extension if not exists pgcrypto;

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text not null,
  slug text not null unique,
  logo text,
  loader_logo text,
  cover_image text,
  description text,
  theme_color text,
  accent_color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  title text not null,
  description text,
  badge_bg text,
  badge_text text,
  badge_glow text,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  username text unique,
  email text,
  rtu_roll_no text,
  branch text,
  year text,
  position text,
  jersey_no text,
  height text,
  mobile text,
  sport text,
  photo text,
  bio text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Global role assignments are separate from club memberships so OWNER can be global.
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  active boolean not null default true,
  custom_permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  photo text,
  name text not null,
  jersey_number text,
  position text,
  category text,
  height text,
  experience text,
  captain boolean not null default false,
  instagram text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.slideshow (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  image text,
  title text,
  date text,
  link text,
  button_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  icon text,
  title text not null,
  time text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team1 text,
  team1_logo text,
  team2 text,
  opponent text,
  team2_logo text,
  date timestamptz,
  venue text,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'completed')),
  score1 integer,
  score2 integer,
  sets text,
  winner text check (winner is null or winner in ('none', 'team1', 'team2', 'draw')),
  is_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.match_score_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  team text,
  point_type text,
  action_id text,
  points integer not null default 0,
  player_username text,
  summary text,
  created_at timestamptz not null default now()
);

create table public.news (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  tag text,
  date text,
  body text,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gallery (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  media_url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  caption text,
  category text,
  card_height integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  quote text not null,
  name text,
  role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stats (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  target integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  poster text,
  title text not null,
  date text,
  time text,
  venue text,
  description text,
  registration_button_text text,
  registration_url text,
  registration_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  email text,
  mobile text,
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  position text,
  experience text,
  message text,
  source text,
  status text not null default 'Pending' check (status in ('Pending', 'Reviewed', 'Accepted', 'Rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  category text,
  content text not null,
  is_pinned boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete cascade,
  title text not null,
  message text not null,
  type text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.club_about (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  eyebrow text,
  title text,
  sub text,
  mission text,
  vision text,
  updated_at timestamptz not null default now()
);

create table public.club_contact (
  club_id uuid primary key references public.clubs(id) on delete cascade,
  address text,
  email text,
  phone text,
  hours text,
  updated_at timestamptz not null default now()
);

create table public.club_contact_buttons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_match_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

create table public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  section text not null check (section in ('team', 'gallery')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, section, name)
);

create index club_memberships_club_id_idx on public.club_memberships (club_id);
create index club_memberships_user_id_idx on public.club_memberships (user_id);
create index players_club_id_idx on public.players (club_id);
create index slideshow_club_order_idx on public.slideshow (club_id, sort_order);
create index training_sessions_club_order_idx on public.training_sessions (club_id, sort_order);
create index matches_club_date_idx on public.matches (club_id, date);
create index matches_live_idx on public.matches (is_live) where is_live = true;
create index match_score_events_match_created_idx on public.match_score_events (match_id, created_at);
create index news_club_date_idx on public.news (club_id, created_at desc);
create index gallery_club_order_idx on public.gallery (club_id, sort_order);
create index events_club_date_idx on public.events (club_id, created_at desc);
create index applications_club_status_idx on public.applications (club_id, status);
create index announcements_club_created_idx on public.announcements (club_id, created_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index user_match_availability_match_idx on public.user_match_availability (match_id);
create index custom_categories_club_section_idx on public.custom_categories (club_id, section);

insert into public.roles (name, title, description, permissions, is_system)
values
  ('OWNER', 'Owner', 'Global owner with full access.', array['*'], true),
  ('STUDENT', 'Student', 'Student profile and club membership access.', array['profile.view', 'profile.edit', 'clubs.join'], true);

create or replace function public.is_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = coalesce(p_user_id, auth.uid())
      and r.name = 'OWNER'
  );
$$;

create or replace function public.can_manage_club(p_club_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner(p_user_id)
    or exists (
      select 1
      from public.club_memberships cm
      join public.roles r on r.id = cm.role_id
      where cm.user_id = coalesce(p_user_id, auth.uid())
        and cm.club_id = p_club_id
        and cm.active
        and r.name in ('OWNER', 'ADMIN', 'CUSTOM')
    );
$$;

create or replace function public.has_club_permission(
  p_club_id uuid,
  p_permission text,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_owner(p_user_id)
    or exists (
      select 1
      from public.club_memberships cm
      join public.roles r on r.id = cm.role_id
      where cm.user_id = coalesce(p_user_id, auth.uid())
        and cm.club_id = p_club_id
        and cm.active
        and (
          r.permissions @> array['*']
          or r.permissions @> array[p_permission]
          or cm.custom_permissions @> array['*']
          or cm.custom_permissions @> array[p_permission]
        )
    );
$$;

alter table public.clubs enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.club_memberships enable row level security;
alter table public.players enable row level security;
alter table public.slideshow enable row level security;
alter table public.training_sessions enable row level security;
alter table public.matches enable row level security;
alter table public.match_score_events enable row level security;
alter table public.news enable row level security;
alter table public.gallery enable row level security;
alter table public.testimonials enable row level security;
alter table public.sponsors enable row level security;
alter table public.stats enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.applications enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.club_about enable row level security;
alter table public.club_contact enable row level security;
alter table public.club_contact_buttons enable row level security;
alter table public.user_match_availability enable row level security;
alter table public.custom_categories enable row level security;

create policy clubs_public_read on public.clubs for select using (active);
create policy clubs_owner_manage on public.clubs for all using (public.is_owner()) with check (public.is_owner());

create policy roles_authenticated_read on public.roles for select to authenticated using (true);
create policy roles_owner_manage on public.roles for all using (public.is_owner()) with check (public.is_owner());

create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_owner());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid() or public.is_owner());
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_owner()) with check (id = auth.uid() or public.is_owner());
create policy profiles_owner_delete on public.profiles for delete using (public.is_owner());

create policy user_roles_self_read on public.user_roles for select using (user_id = auth.uid() or public.is_owner());
create policy user_roles_owner_manage on public.user_roles for all using (public.is_owner()) with check (public.is_owner());

create policy memberships_self_read on public.club_memberships for select using (user_id = auth.uid() or public.can_manage_club(club_id));
create policy memberships_self_join on public.club_memberships for insert with check (user_id = auth.uid() and public.has_club_permission(club_id, 'clubs.join'));
create policy memberships_owner_manage on public.club_memberships for all using (public.is_owner()) with check (public.is_owner());
create policy memberships_admin_manage on public.club_memberships for all
  using (public.can_manage_club(club_id) and not public.is_owner())
  with check (
    public.can_manage_club(club_id)
    and exists (
      select 1
      from public.roles r
      where r.id = role_id
        and r.name <> 'OWNER'
    )
  );

create policy players_public_read on public.players for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy players_admin_manage on public.players for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy slideshow_public_read on public.slideshow for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy slideshow_admin_manage on public.slideshow for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy training_public_read on public.training_sessions for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy training_admin_manage on public.training_sessions for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy matches_public_read on public.matches for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy matches_admin_manage on public.matches for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy score_events_public_read on public.match_score_events for select using (exists (select 1 from public.matches m join public.clubs c on c.id = m.club_id where m.id = match_id and c.active));
create policy score_events_admin_manage on public.match_score_events for all using (exists (select 1 from public.matches m where m.id = match_id and public.can_manage_club(m.club_id))) with check (exists (select 1 from public.matches m where m.id = match_id and public.can_manage_club(m.club_id)));

create policy news_public_read on public.news for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy news_admin_manage on public.news for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy gallery_public_read on public.gallery for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy gallery_admin_manage on public.gallery for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy testimonials_public_read on public.testimonials for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy testimonials_admin_manage on public.testimonials for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy sponsors_public_read on public.sponsors for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy sponsors_admin_manage on public.sponsors for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy stats_public_read on public.stats for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy stats_admin_manage on public.stats for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy events_public_read on public.events for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy events_admin_manage on public.events for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy rsvps_self_read on public.event_rsvps for select using (user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and public.can_manage_club(e.club_id)));
create policy rsvps_self_insert on public.event_rsvps for insert with check (user_id = auth.uid());
create policy rsvps_self_update on public.event_rsvps for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy rsvps_self_delete on public.event_rsvps for delete using (user_id = auth.uid() or exists (select 1 from public.events e where e.id = event_id and public.can_manage_club(e.club_id)));
create policy rsvps_admin_manage on public.event_rsvps for all using (exists (select 1 from public.events e where e.id = event_id and public.can_manage_club(e.club_id))) with check (exists (select 1 from public.events e where e.id = event_id and public.can_manage_club(e.club_id)));

create policy applications_public_insert on public.applications for insert with check (user_id is null or user_id = auth.uid());
create policy applications_self_read on public.applications for select using (user_id = auth.uid() or (user_id is null and lower(email) = lower(coalesce((select p.email from public.profiles p where p.id = auth.uid()), '')) ) or public.can_manage_club(club_id));
create policy applications_self_update on public.applications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy applications_admin_manage on public.applications for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy announcements_public_read on public.announcements for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy announcements_admin_manage on public.announcements for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy notifications_self_read on public.notifications for select using (user_id = auth.uid() or public.can_manage_club(club_id));
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_admin_manage on public.notifications for all using (club_id is not null and public.can_manage_club(club_id)) with check (club_id is not null and public.can_manage_club(club_id));

create policy club_about_public_read on public.club_about for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy club_about_admin_manage on public.club_about for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy club_contact_public_read on public.club_contact for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy club_contact_admin_manage on public.club_contact for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy contact_buttons_public_read on public.club_contact_buttons for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy contact_buttons_admin_manage on public.club_contact_buttons for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

create policy availability_self_read on public.user_match_availability for select using (user_id = auth.uid() or exists (select 1 from public.matches m where m.id = match_id and public.can_manage_club(m.club_id)));
create policy availability_self_manage on public.user_match_availability for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy availability_admin_manage on public.user_match_availability for all using (exists (select 1 from public.matches m where m.id = match_id and public.can_manage_club(m.club_id))) with check (exists (select 1 from public.matches m where m.id = match_id and public.can_manage_club(m.club_id)));

create policy categories_public_read on public.custom_categories for select using (exists (select 1 from public.clubs c where c.id = club_id and c.active));
create policy categories_admin_manage on public.custom_categories for all using (public.can_manage_club(club_id)) with check (public.can_manage_club(club_id));

commit;
