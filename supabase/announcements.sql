-- ============================================================
--  MAD REWARDS — announcements + text-message opt-in
--  Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- ============================================================

-- Creators choose at sign-up whether we may text them.
alter table public.creators add column if not exists sms_opt_in boolean not null default false;

-- Announcements shown as a banner on every creator's dashboard.
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "creators read active announcements" on public.announcements;
create policy "creators read active announcements" on public.announcements
  for select to authenticated using (active = true);
