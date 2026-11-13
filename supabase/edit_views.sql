-- ============================================================
--  MAD REWARDS — creators can change the views on a video they dropped
--  Paste into Supabase → SQL Editor → Run. Safe to run more than once.
--
--  Allowed only when ALL of these are true:
--    • the video is the creator's own
--    • it is still pending (not approved / rejected / paid yet)
--    • its week is still open: through Sunday (grace day) right after
--      the Sun–Sat week it was posted in, Los Angeles time
-- ============================================================
create or replace function public.update_my_views(p_id uuid, p_views integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today  date := (now() at time zone 'America/Los_Angeles')::date;
  v_posted date;
  v_status text;
begin
  if p_views is null or p_views <= 0 then
    raise exception 'Add the views.';
  end if;

  select coalesce(posted_at::date, (created_at at time zone 'America/Los_Angeles')::date),
         coalesce(status, 'pending')
    into v_posted, v_status
    from public.video_submissions
   where id = p_id and creator_id = auth.uid();

  if not found then
    raise exception 'Video not found.';
  end if;
  if v_status <> 'pending' then
    raise exception 'This video was already checked, so its views are locked.';
  end if;
  -- week starts Sunday; editable until the following Sunday (grace day) ends
  if v_today > (v_posted - extract(dow from v_posted)::int + 7) then
    raise exception 'That week is closed, so its views are locked.';
  end if;

  update public.video_submissions
     set claimed_views = p_views
   where id = p_id and creator_id = auth.uid();
end;
$$;
revoke all on function public.update_my_views(uuid, integer) from public, anon;
grant execute on function public.update_my_views(uuid, integer) to authenticated;
