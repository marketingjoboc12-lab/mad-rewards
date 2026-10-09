-- ============================================================
--  MAD REWARDS — launch setup
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to run more than once.
-- ============================================================

-- 1. Payouts: one row each time a creator is paid for a week (or given a monthly prize).
create table if not exists public.payouts (
  id           uuid primary key default gen_random_uuid(),
  creator_id   uuid not null references public.creators(id) on delete cascade,
  period       text not null check (period in ('week', 'month')),
  period_start date not null,
  amount       numeric not null default 0,
  label        text,
  details      jsonb,
  paid_at      timestamptz not null default now(),
  unique (creator_id, period, period_start)
);

-- 2. The same video link can't be submitted twice.
--    (If this line errors with "could not create unique index", there are already
--     duplicate links — run the query at the bottom of this file to find them.)
create unique index if not exists video_submissions_url_unique
  on public.video_submissions (lower(trim(video_url)));

-- 3. Privacy rules (row-level security).
--    Creators only ever see their OWN data. Everything else goes through the
--    admin page, which uses the server-side service key.
alter table public.creators          enable row level security;
alter table public.video_submissions enable row level security;
alter table public.campaigns         enable row level security;
alter table public.invite_codes      enable row level security;
alter table public.signup_requests   enable row level security;
alter table public.payouts           enable row level security;

-- wipe any older/looser policies on these tables, then add the exact ones we want
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('creators','video_submissions','campaigns','invite_codes','signup_requests','payouts')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "creator reads own profile" on public.creators
  for select to authenticated using (id = auth.uid());

create policy "creator reads own videos" on public.video_submissions
  for select to authenticated using (creator_id = auth.uid());

create policy "creator submits own videos" on public.video_submissions
  for insert to authenticated with check (
    creator_id = auth.uid()
    and coalesce(status, 'pending') = 'pending'
    and coalesce(views, 0) = 0
    and coalesce(paid, false) = false
    and coalesce(reward_amount, 0) = 0
  );

create policy "creator reads own payouts" on public.payouts
  for select to authenticated using (creator_id = auth.uid());

create policy "anyone reads the active campaign" on public.campaigns
  for select to anon, authenticated using (active = true);

create policy "anyone can request an invite" on public.signup_requests
  for insert to anon, authenticated with check (
    coalesce(status, 'pending') = 'pending' and invite_code is null
  );

-- invite_codes: no policies on purpose → only the server can read/write them.

-- ------------------------------------------------------------
-- Helper (run on its own if step 2 failed): list duplicate links.
-- select lower(trim(video_url)) as link, count(*) from public.video_submissions
-- group by 1 having count(*) > 1;
-- ------------------------------------------------------------

-- 4. Rules agreement: creators must swipe to accept the rules once.
alter table public.creators add column if not exists rules_accepted_at timestamptz;

create or replace function public.accept_rules()
returns void language sql security definer set search_path = public as $$
  update public.creators set rules_accepted_at = now() where id = auth.uid();
$$;
revoke all on function public.accept_rules() from public, anon;
grant execute on function public.accept_rules() to authenticated;
