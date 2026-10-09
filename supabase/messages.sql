-- ============================================================
--  MAD REWARDS — contact messages from creators
--  Paste into Supabase → SQL Editor → Run. Safe to run more than once.
-- ============================================================
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  topic      text not null default 'suggestion',
  body       text not null,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "creator sends own messages" on public.messages;
create policy "creator sends own messages" on public.messages
  for insert to authenticated with check (creator_id = auth.uid() and handled = false);
drop policy if exists "creator reads own messages" on public.messages;
create policy "creator reads own messages" on public.messages
  for select to authenticated using (creator_id = auth.uid());
