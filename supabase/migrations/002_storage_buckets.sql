begin;

insert into storage.buckets (id, name, public)
values
  ('player-photos', 'player-photos', true),
  ('club-logos', 'club-logos', true),
  ('hero-slides', 'hero-slides', true),
  ('gallery-media', 'gallery-media', true),
  ('event-posters', 'event-posters', true),
  ('sponsor-logos', 'sponsor-logos', true)
on conflict (id) do update set public = excluded.public;

create policy storage_public_read on storage.objects
for select using (bucket_id in ('player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos'));

create policy storage_authenticated_upload on storage.objects
for insert to authenticated
with check (
  bucket_id in ('player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos')
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and c.slug = (storage.foldername(name))[1]
        and public.can_manage_club(cm.club_id)
    )
  )
);

create policy storage_authenticated_update on storage.objects
for update to authenticated
using (
  bucket_id in ('player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos')
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and c.slug = (storage.foldername(name))[1]
        and public.can_manage_club(cm.club_id)
    )
  )
)
with check (
  bucket_id in ('player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos')
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and c.slug = (storage.foldername(name))[1]
        and public.can_manage_club(cm.club_id)
    )
  )
);

create policy storage_authenticated_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('player-photos', 'club-logos', 'hero-slides', 'gallery-media', 'event-posters', 'sponsor-logos')
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and c.slug = (storage.foldername(name))[1]
        and public.can_manage_club(cm.club_id)
    )
  )
);

commit;
