-- ============================================================
--  MAD REWARDS — creator profile pictures
--  Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
--  Pictures live in a public Storage bucket "avatars", one folder per
--  creator (avatars/<creator id>/...). A creator can only add, replace or
--  remove files in their own folder. Max 2 MB, images only.
-- ============================================================

-- 1. Where the picture's link is saved on the creator
alter table public.creators add column if not exists avatar_url text;

-- 2. The bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3. Who can write to it
drop policy if exists "creator uploads own avatar" on storage.objects;
create policy "creator uploads own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "creator updates own avatar" on storage.objects;
create policy "creator updates own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "creator deletes own avatar" on storage.objects;
create policy "creator deletes own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "creator lists own avatar" on storage.objects;
create policy "creator lists own avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4. Save (or clear, with null) the creator's own picture link.
--    Only links into their own avatars folder are accepted.
create or replace function public.set_my_avatar(p_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_url is not null and position('/storage/v1/object/public/avatars/' || auth.uid()::text || '/' in p_url) = 0 then
    raise exception 'That picture link is not allowed.';
  end if;
  update public.creators set avatar_url = p_url where id = auth.uid();
end;
$$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
