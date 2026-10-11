-- VELVET RIPPLE · 645 · shared handprints on the glass
-- safe to run more than once. run it in the supabase sql editor (same project as the logbook).
-- the page falls back to browser-local prints if this table does not exist.
-- real prints only — nothing is seeded.
create table if not exists public.pane_prints (
  id bigint generated always as identity primary key,
  x  real   not null check (x between 0 and 1),
  y  real   not null check (y between 0 and 1),
  r  real   not null default 0,
  t  bigint not null,                      -- ms since epoch, set by the client; drives the fade
  name text,                               -- optional: a name for the hand (≤ 24 chars, cleaned client-side)
  created_at timestamptz not null default now()
);
-- if you ran an earlier version of this file, add the name column to the existing table:
alter table public.pane_prints add column if not exists name text;
alter table public.pane_prints enable row level security;
drop policy if exists "prints are public" on public.pane_prints;
create policy "prints are public"  on public.pane_prints for select using (true);
drop policy if exists "anyone may press" on public.pane_prints;
create policy "anyone may press"   on public.pane_prints for insert with check (true);
-- optional housekeeping: prints older than two weeks are invisible anyway
-- delete from public.pane_prints where created_at < now() - interval '14 days';
