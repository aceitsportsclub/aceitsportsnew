begin;

-- Ensure gallery-media bucket exists and is public
insert into storage.buckets (id, name, public)
values ('gallery-media', 'gallery-media', true)
on conflict (id) do update set public = excluded.public;

-- Ensure public read for gallery-media
drop policy if exists storage_gallery_media_read on storage.objects;
create policy storage_gallery_media_read on storage.objects
for select using (bucket_id = 'gallery-media');

-- Allow authenticated OWNER or authorized club managers to upload to gallery-media
drop policy if exists storage_gallery_media_upload on storage.objects;
create policy storage_gallery_media_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'gallery-media'
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and (
          c.slug = coalesce((storage.foldername(name))[1], 'spikers')
          or c.id::text = (storage.foldername(name))[1]
        )
        and public.can_manage_club(cm.club_id)
    )
  )
);

-- Allow authenticated OWNER or authorized club managers to update gallery-media
drop policy if exists storage_gallery_media_update on storage.objects;
create policy storage_gallery_media_update on storage.objects
for update to authenticated
using (
  bucket_id = 'gallery-media'
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and (
          c.slug = coalesce((storage.foldername(name))[1], 'spikers')
          or c.id::text = (storage.foldername(name))[1]
        )
        and public.can_manage_club(cm.club_id)
    )
  )
)
with check (
  bucket_id = 'gallery-media'
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and (
          c.slug = coalesce((storage.foldername(name))[1], 'spikers')
          or c.id::text = (storage.foldername(name))[1]
        )
        and public.can_manage_club(cm.club_id)
    )
  )
);

-- Allow authenticated OWNER or authorized club managers to delete from gallery-media
drop policy if exists storage_gallery_media_delete on storage.objects;
create policy storage_gallery_media_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'gallery-media'
  and (
    public.is_owner()
    or exists (
      select 1
      from public.club_memberships cm
      join public.clubs c on c.id = cm.club_id
      where cm.user_id = auth.uid()
        and cm.active
        and (
          c.slug = coalesce((storage.foldername(name))[1], 'spikers')
          or c.id::text = (storage.foldername(name))[1]
        )
        and public.can_manage_club(cm.club_id)
    )
  )
);

commit;
