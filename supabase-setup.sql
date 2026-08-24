-- VELVET RIPPLE · 108.0 — public comms logbook
-- ===================================================================
-- run this ONCE, whole, in: supabase dashboard → SQL editor → new query
--
-- the shape of the thing:
--   · anon can READ the logbook, through a view that cannot leak the
--     delete tokens.
--   · anon can NEVER touch the table directly — no insert, no update,
--     no delete. row-level security is on with zero policies, which
--     denies everything.
--   · every write goes through a security-definer function that checks
--     a secret first. so "delete your own" and "the owner deletes any"
--     are enforced by postgres, not by hiding buttons in javascript.
--
-- after running this, scroll to STEP 2 at the bottom and set your
-- moderator passphrase. nothing works for you as moderator until you do.
-- ===================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- the table ----------------------------------------------
-- token_hash is the sha256 of a random string kept in the writer's
-- browser. we store only the hash, so a database leak still does not
-- let anyone delete anyone else's line.
create table if not exists public.comms (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  callsign   text not null check (callsign ~ '^VR-[0-9]{4}$'),
  body       text not null check (char_length(btrim(body)) between 1 and 80),
  token_hash text not null,
  hidden     boolean not null default false
);

create index if not exists comms_created_idx on public.comms (created_at);
create index if not exists comms_token_idx   on public.comms (token_hash);

-- lock the table itself: RLS on, no policies at all = nothing gets
-- through except the security-definer functions below.
alter table public.comms enable row level security;
revoke all on public.comms from anon, authenticated;

-- ---------- the public read surface --------------------------------
-- note the columns that are NOT here: token_hash and hidden.
create or replace view public.comms_public as
  select id, created_at, callsign, body
    from public.comms
   where not hidden;

-- run as the view's owner, so it can see through the table's RLS.
-- this is deliberate: it is the only read path anon is given.
alter view public.comms_public set (security_invoker = false);
grant select on public.comms_public to anon, authenticated;

-- ---------- the moderator secret -----------------------------------
-- holds the sha256 of your passphrase. no one but the functions can
-- read it: RLS on, no policies, all grants revoked.
create table if not exists public.comms_secret (
  k text primary key,
  v text not null
);
alter table public.comms_secret enable row level security;
revoke all on public.comms_secret from anon, authenticated;

-- ---------- post a line --------------------------------------------
create or replace function public.comms_post(
  p_callsign text, p_body text, p_token text
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id uuid;
  v_hash text;
  v_recent int;
begin
  if p_token is null or char_length(p_token) < 24 then
    raise exception 'bad token';
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- one live line per visitor. this is the site's own copy ("one line,
  -- once.") and it doubles as the main spam ceiling: whatever a bot
  -- does, it can only ever have ONE line standing at a time.
  if exists (select 1 from public.comms where token_hash = v_hash) then
    raise exception 'already logged';
  end if;

  -- and a flood guard for token churn, keyed on nothing but volume
  select count(*) into v_recent from public.comms
   where created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'channel busy';
  end if;

  insert into public.comms (callsign, body, token_hash)
       values (p_callsign, btrim(p_body), v_hash)
    returning id into v_id;
  return v_id;
end $$;

-- ---------- delete your own ----------------------------------------
create or replace function public.comms_delete_own(
  p_id uuid, p_token text
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  delete from public.comms
        where id = p_id
          and token_hash = encode(digest(p_token, 'sha256'), 'hex');
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------- delete any (that's you) --------------------------------
create or replace function public.comms_delete_mod(
  p_id uuid, p_key text
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_expect text;
  n int;
begin
  select v into v_expect from public.comms_secret where k = 'mod';
  if v_expect is null then
    return false;                       -- STEP 2 was never run
  end if;
  if encode(digest(p_key, 'sha256'), 'hex') is distinct from v_expect then
    perform pg_sleep(0.5);              -- blunt the guessing rate
    return false;
  end if;
  delete from public.comms where id = p_id;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- ---------- set the moderator passphrase ---------------------------
-- a helper, so STEP 2 is one readable line and there is no way to get
-- the hashing wrong. pgcrypto lives in the `extensions` schema on
-- supabase, so a bare digest() at the sql prompt does NOT resolve —
-- this function carries the right search_path so you never meet that.
-- deliberately NOT granted to anon: only you, from the dashboard or
-- the cli, can change the key.
create or replace function public.comms_set_mod_key(p_key text)
returns text
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_key is null or char_length(p_key) < 12 then
    raise exception 'pick a longer passphrase (12 characters minimum)';
  end if;
  insert into public.comms_secret (k, v)
       values ('mod', encode(digest(p_key, 'sha256'), 'hex'))
  on conflict (k) do update set v = excluded.v;
  return 'moderator key set';
end $$;

-- ---------- grants --------------------------------------------------
revoke all on function public.comms_post(text, text, text)  from public;
revoke all on function public.comms_delete_own(uuid, text)   from public;
revoke all on function public.comms_delete_mod(uuid, text)   from public;
revoke all on function public.comms_set_mod_key(text)        from public;

grant execute on function public.comms_post(text, text, text) to anon, authenticated;
grant execute on function public.comms_delete_own(uuid, text)  to anon, authenticated;
grant execute on function public.comms_delete_mod(uuid, text)  to anon, authenticated;

-- the key-setter stays out of the website's reach entirely
revoke all on function public.comms_set_mod_key(text) from anon, authenticated;


-- ===================================================================
-- STEP 2 — set your moderator passphrase
-- ===================================================================
-- run this one line with your own passphrase. only the sha256 is
-- stored, so the passphrase itself never lands in the database and
-- never appears in the site's source.
--
-- pick something long. it is the only thing standing between a stranger
-- and deleting the whole logbook.
--
--   select public.comms_set_mod_key('CHANGE-THIS-PASSPHRASE');
--
-- it prints 'moderator key set'. run it again any time to change the
-- passphrase. until you run it, moderator delete simply returns false.
-- ===================================================================


-- ===================================================================
-- housekeeping you may want later
-- ===================================================================
-- see everything, including what you have hidden:
--   select id, created_at, callsign, body, hidden from public.comms
--    order by created_at desc;
--
-- hide a line instead of destroying it (keeps the evidence):
--   update public.comms set hidden = true where id = '...';
--
-- wipe the logbook:
--   truncate public.comms;
