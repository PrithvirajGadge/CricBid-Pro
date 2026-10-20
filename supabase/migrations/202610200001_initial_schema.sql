-- Stumped Bid: schema, RLS and server-authoritative functions.
-- All state transitions happen in SECURITY DEFINER functions. Clients get SELECT only (via RLS).
create extension if not exists pgcrypto;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  status text not null default 'lobby' check (status in ('lobby','active','paused','completed','closed')),
  settings jsonb not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  role text not null default 'participant' check (role in ('host','participant','viewer')),
  status text not null default 'active' check (status in ('active','left')),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);
create unique index participants_nick_uq on public.participants (room_id, lower(display_name)) where status = 'active';

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  owner_participant_id uuid unique references public.participants(id) on delete set null,
  initial_purse numeric(10,2) not null check (initial_purse > 0),
  remaining_purse numeric(10,2) not null check (remaining_purse >= 0),
  roster_limit int not null check (roster_limit between 1 and 30),
  created_at timestamptz not null default now(),
  unique (room_id, name)
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  role text not null check (role in ('Batter','Bowler','Allrounder','Wicketkeeper')),
  nationality text check (char_length(nationality) <= 60),
  base_price numeric(10,2) not null check (base_price > 0),
  image_url text check (image_url is null or image_url ~ '^https://'),
  status text not null default 'upcoming' check (status in ('upcoming','live','sold','unsold','removed')),
  sort_order bigint generated always as identity,
  sold_team_id uuid references public.teams(id),
  sold_price numeric(10,2),
  created_at timestamptz not null default now(),
  unique (room_id, name)
);
create index players_room_status_idx on public.players (room_id, status, sort_order);

create table public.auction_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  status text not null default 'idle' check (status in ('idle','live','paused')),
  current_player_id uuid references public.players(id),
  deadline_at timestamptz,
  paused_remaining_ms bigint,
  current_bid numeric(10,2),
  leading_team_id uuid references public.teams(id),
  leading_participant_id uuid references public.participants(id),
  event_sequence bigint not null default 0,
  updated_at timestamptz not null default now()
);
create index auction_state_due_idx on public.auction_state (deadline_at) where status = 'live';

create table public.bids (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id),
  team_id uuid not null references public.teams(id),
  participant_id uuid not null references public.participants(id),
  amount numeric(10,2) not null check (amount > 0),
  sequence bigint not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (room_id, idempotency_key),
  unique (room_id, sequence)
);
create index bids_room_player_seq_idx on public.bids (room_id, player_id, sequence desc);

create table public.purse_ledger (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  amount numeric(10,2) not null,
  reason text not null check (reason in ('sale')),
  created_at timestamptz not null default now(),
  unique (player_id, reason)            -- a player can be sold/debited at most once
);

create table public.auction_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sequence bigint not null,
  event_type text not null,
  payload jsonb not null default '{}',
  actor_participant_id uuid references public.participants(id),
  created_at timestamptz not null default now(),
  unique (room_id, sequence)
);

-- ---------- RLS: deny by default; members may SELECT their own room only ----------
create function public.is_room_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participants p
                 where p.room_id = r and p.user_id = auth.uid() and p.status = 'active');
$$;

do $$ declare t text; begin
  foreach t in array array['rooms','participants','teams','players','auction_state','bids','purse_ledger','auction_events'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create policy rooms_select on public.rooms for select to authenticated using (public.is_room_member(id));
create policy participants_select on public.participants for select to authenticated using (public.is_room_member(room_id));
create policy teams_select on public.teams for select to authenticated using (public.is_room_member(room_id));
create policy players_select on public.players for select to authenticated using (public.is_room_member(room_id));
create policy auction_state_select on public.auction_state for select to authenticated using (public.is_room_member(room_id));
create policy bids_select on public.bids for select to authenticated using (public.is_room_member(room_id));
create policy ledger_select on public.purse_ledger for select to authenticated using (public.is_room_member(room_id));
create policy events_select on public.auction_events for select to authenticated using (public.is_room_member(room_id));

revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;   -- no INSERT/UPDATE/DELETE policies exist => writes denied

-- ---------- internal helpers (not callable by clients) ----------
create function public.log_event(p_room uuid, p_type text, p_payload jsonb, p_actor uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare seq bigint;
begin
  update public.auction_state set event_sequence = event_sequence + 1, updated_at = now()
   where room_id = p_room returning event_sequence into seq;
  insert into public.auction_events (room_id, sequence, event_type, payload, actor_participant_id)
  values (p_room, seq, p_type, coalesce(p_payload, '{}'), p_actor);
  update public.rooms set version = version + 1, updated_at = now() where id = p_room;
  return seq;
end $$;

create function public.require_host(p_room uuid) returns public.participants
language plpgsql security definer set search_path = public as $$
declare part public.participants;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into part from public.participants
   where room_id = p_room and user_id = auth.uid() and status = 'active' and role = 'host';
  if not found then raise exception 'NOT_HOST' using errcode = 'P0001'; end if;
  return part;
end $$;

-- Idempotent sale/unsold finalization. Locks auction_state first, then the team (same order as place_bid).
create function public.finalize_lot(p_room uuid, p_force boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare st public.auction_state; n int; outcome text;
begin
  select * into st from public.auction_state where room_id = p_room for update;
  if not found or st.status <> 'live' then return 'noop'; end if;
  if st.deadline_at > now() and not p_force then return 'not_due'; end if;

  if st.leading_team_id is not null then
    perform 1 from public.teams where id = st.leading_team_id for update;
    insert into public.purse_ledger (room_id, team_id, player_id, amount, reason)
    values (p_room, st.leading_team_id, st.current_player_id, -st.current_bid, 'sale')
    on conflict (player_id, reason) do nothing;
    get diagnostics n = row_count;
    if n = 1 then
      update public.teams set remaining_purse = remaining_purse - st.current_bid where id = st.leading_team_id;
      update public.players set status = 'sold', sold_team_id = st.leading_team_id, sold_price = st.current_bid
       where id = st.current_player_id;
    end if;
    outcome := 'sold';
  else
    update public.players set status = 'unsold' where id = st.current_player_id and status = 'live';
    outcome := 'unsold';
  end if;

  perform public.log_event(p_room, 'lot_' || outcome,
    jsonb_build_object('player_id', st.current_player_id, 'team_id', st.leading_team_id, 'price', st.current_bid), null);
  update public.auction_state set status = 'idle', current_player_id = null, deadline_at = null,
         paused_remaining_ms = null, current_bid = null, leading_team_id = null, leading_participant_id = null
   where room_id = p_room;
  return outcome;
end $$;

-- ---------- client-callable RPCs ----------
create function public.server_time() returns timestamptz language sql stable as $$ select now() $$;

create function public.create_room(p_name text, p_nickname text, p_team_names text[], p_settings jsonb default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); rid uuid; pid uuid; tries int := 0; s jsonb; nm text; v_code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if (select count(*) from public.rooms where host_user_id = uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
  if coalesce(array_length(p_team_names, 1), 0) not between 2 and 12 then raise exception 'BAD_TEAM_COUNT' using errcode = 'P0001'; end if;
  s := jsonb_build_object(
    'purse', coalesce((p_settings->>'purse')::numeric, 100),
    'increment', coalesce((p_settings->>'increment')::numeric, 0.25),
    'timer_seconds', coalesce((p_settings->>'timer_seconds')::int, 20),
    'extend_seconds', coalesce((p_settings->>'extend_seconds')::int, 10),
    'roster_limit', coalesce((p_settings->>'roster_limit')::int, 15),
    'max_participants', coalesce((p_settings->>'max_participants')::int, 20));
  if (s->>'purse')::numeric not between 1 and 100000 or (s->>'increment')::numeric <= 0
     or (s->>'timer_seconds')::int not between 5 and 120 or (s->>'extend_seconds')::int not between 0 and 60
     or (s->>'roster_limit')::int not between 1 and 30 or (s->>'max_participants')::int not between 2 and 50 then
    raise exception 'BAD_SETTINGS' using errcode = 'P0001';
  end if;
  loop
    v_code := (select string_agg(substr(alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % 32), 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.rooms where rooms.code = v_code);
    tries := tries + 1; if tries > 20 then raise exception 'CODE_GENERATION_FAILED' using errcode = 'P0001'; end if;
  end loop;
  insert into public.rooms (code, host_user_id, name, settings) values (v_code, uid, trim(p_name), s) returning id into rid;
  insert into public.participants (room_id, user_id, display_name, role) values (rid, uid, trim(p_nickname), 'host') returning id into pid;
  foreach nm in array p_team_names loop
    insert into public.teams (room_id, name, initial_purse, remaining_purse, roster_limit)
    values (rid, trim(nm), (s->>'purse')::numeric, (s->>'purse')::numeric, (s->>'roster_limit')::int);
  end loop;
  insert into public.auction_state (room_id) values (rid);
  perform public.log_event(rid, 'room_created', '{}', pid);
  return v_code;
end $$;

create function public.join_room(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.rooms; part public.participants;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  select * into r from public.rooms where code = upper(trim(p_code));
  if not found then raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001'; end if;
  if r.status in ('completed','closed') then raise exception 'ROOM_CLOSED' using errcode = 'P0001'; end if;
  select * into part from public.participants where room_id = r.id and user_id = uid;
  if found then
    update public.participants set status = 'active' where id = part.id;
    perform public.log_event(r.id, 'participant_rejoined', '{}', part.id);
    return r.id;
  end if;
  if (select count(*) from public.participants where room_id = r.id and status = 'active') >= (r.settings->>'max_participants')::int then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  begin
    insert into public.participants (room_id, user_id, display_name) values (r.id, uid, trim(p_nickname)) returning id into part.id;
  exception when unique_violation then raise exception 'NICKNAME_TAKEN' using errcode = 'P0001';
  end;
  perform public.log_event(r.id, 'participant_joined', '{}', part.id);
  return r.id;
end $$;

create function public.claim_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.teams; part public.participants; st public.auction_state;
begin
  select * into t from public.teams where id = p_team_id;
  if not found then raise exception 'TEAM_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into part from public.participants where room_id = t.room_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;
  if part.role = 'viewer' then raise exception 'NOT_ALLOWED' using errcode = 'P0001'; end if;
  select * into st from public.auction_state where room_id = t.room_id for update;
  if st.status <> 'idle' then raise exception 'AUCTION_BUSY' using errcode = 'P0001'; end if;
  begin
    update public.teams set owner_participant_id = part.id where id = p_team_id and owner_participant_id is null;
    if not found then raise exception 'TEAM_TAKEN' using errcode = 'P0001'; end if;
  exception when unique_violation then raise exception 'ALREADY_HAS_TEAM' using errcode = 'P0001';
  end;
  perform public.log_event(t.room_id, 'team_claimed', jsonb_build_object('team_id', p_team_id), part.id);
end $$;

create function public.release_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.teams; part public.participants; st public.auction_state;
begin
  select * into t from public.teams where id = p_team_id;
  if not found then raise exception 'TEAM_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into part from public.participants where room_id = t.room_id and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;
  if part.role <> 'host' and t.owner_participant_id is distinct from part.id then raise exception 'NOT_ALLOWED' using errcode = 'P0001'; end if;
  select * into st from public.auction_state where room_id = t.room_id for update;
  if st.status <> 'idle' then raise exception 'AUCTION_BUSY' using errcode = 'P0001'; end if;
  update public.teams set owner_participant_id = null where id = p_team_id;
  perform public.log_event(t.room_id, 'team_released', jsonb_build_object('team_id', p_team_id), part.id);
end $$;

create function public.import_players(p_room uuid, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare host public.participants := public.require_host(p_room); rw jsonb; n int := 0;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500 then
    raise exception 'BAD_IMPORT' using errcode = 'P0001';
  end if;
  for rw in select * from jsonb_array_elements(p_rows) loop
    begin
      insert into public.players (room_id, name, role, nationality, base_price, image_url)
      values (p_room, trim(rw->>'name'), rw->>'role', nullif(trim(rw->>'nationality'), ''),
              (rw->>'base_price')::numeric, nullif(rw->>'image_url', ''));
      n := n + 1;
    exception when unique_violation then null;      -- same name already in this room: skip
      when check_violation or invalid_text_representation or not_null_violation then
        raise exception 'BAD_IMPORT_ROW: %', coalesce(rw->>'name', '?') using errcode = 'P0001';
    end;
  end loop;
  perform public.log_event(p_room, 'players_imported', jsonb_build_object('count', n), host.id);
  return n;
end $$;

create function public.start_next_lot(p_room uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare host public.participants := public.require_host(p_room); r public.rooms; st public.auction_state; pl public.players;
begin
  select * into st from public.auction_state where room_id = p_room for update;
  select * into r from public.rooms where id = p_room;
  if r.status not in ('lobby','active') then raise exception 'ROOM_NOT_STARTABLE' using errcode = 'P0001'; end if;
  if st.status <> 'idle' then raise exception 'LOT_ALREADY_LIVE' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.teams where room_id = p_room and owner_participant_id is not null) then
    raise exception 'NO_TEAMS_CLAIMED' using errcode = 'P0001';
  end if;
  select * into pl from public.players where room_id = p_room and status = 'upcoming' order by sort_order limit 1 for update;
  if not found then raise exception 'NO_PLAYERS' using errcode = 'P0001'; end if;
  update public.players set status = 'live' where id = pl.id;
  update public.auction_state set status = 'live', current_player_id = pl.id,
         deadline_at = now() + ((r.settings->>'timer_seconds')::int || ' seconds')::interval,
         current_bid = null, leading_team_id = null, leading_participant_id = null where room_id = p_room;
  update public.rooms set status = 'active' where id = p_room;
  perform public.log_event(p_room, 'lot_started', jsonb_build_object('player_id', pl.id), host.id);
  return pl.id;
end $$;

create function public.place_bid(p_room uuid, p_amount numeric, p_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); part public.participants; r public.rooms; st public.auction_state;
  t public.teams; pl public.players; ex public.bids; inc numeric; minbid numeric;
  owned int; upcoming int; min_base numeric; slots int; seq bigint; bid_id uuid;
begin
  if uid is null then raise exception 'UNAUTHENTICATED' using errcode = 'P0001'; end if;
  if p_key is null or char_length(p_key) not between 8 and 64 then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
  select * into part from public.participants where room_id = p_room and user_id = uid and status = 'active';
  if not found then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;

  select * into st from public.auction_state where room_id = p_room for update;   -- serializes competing bids
  select * into ex from public.bids where room_id = p_room and idempotency_key = p_key;
  if found then
    if ex.participant_id <> part.id then raise exception 'BAD_KEY' using errcode = 'P0001'; end if;
    return jsonb_build_object('bid_id', ex.id, 'amount', ex.amount, 'sequence', ex.sequence, 'replay', true);
  end if;

  select * into r from public.rooms where id = p_room;
  if r.status <> 'active' then raise exception 'AUCTION_NOT_ACTIVE' using errcode = 'P0001'; end if;
  if st.status <> 'live' then raise exception 'NO_LIVE_LOT' using errcode = 'P0001'; end if;
  if st.deadline_at <= now() then raise exception 'TIMER_EXPIRED' using errcode = 'P0001'; end if;

  select * into t from public.teams where room_id = p_room and owner_participant_id = part.id for update;
  if not found then raise exception 'NO_TEAM' using errcode = 'P0001'; end if;
  if st.leading_team_id = t.id then raise exception 'ALREADY_LEADING' using errcode = 'P0001'; end if;

  select * into pl from public.players where id = st.current_player_id;
  inc := (r.settings->>'increment')::numeric;
  minbid := case when st.current_bid is null then pl.base_price else st.current_bid + inc end;
  if p_amount < minbid then raise exception 'BID_TOO_LOW' using errcode = 'P0001'; end if;
  if mod(p_amount - pl.base_price, inc) <> 0 then raise exception 'BAD_INCREMENT' using errcode = 'P0001'; end if;

  select count(*) into owned from public.players where sold_team_id = t.id and status = 'sold';
  if owned >= t.roster_limit then raise exception 'ROSTER_FULL' using errcode = 'P0001'; end if;
  if t.remaining_purse < p_amount then raise exception 'INSUFFICIENT_PURSE' using errcode = 'P0001'; end if;
  select count(*), coalesce(min(base_price), 0) into upcoming, min_base from public.players where room_id = p_room and status = 'upcoming';
  slots := least(greatest(t.roster_limit - owned - 1, 0), upcoming);
  if t.remaining_purse - p_amount < slots * min_base then raise exception 'PURSE_RESERVE' using errcode = 'P0001'; end if;

  update public.auction_state
     set current_bid = p_amount, leading_team_id = t.id, leading_participant_id = part.id,
         deadline_at = greatest(deadline_at, now() + ((r.settings->>'extend_seconds')::int || ' seconds')::interval)
   where room_id = p_room;
  seq := public.log_event(p_room, 'bid', jsonb_build_object('team_id', t.id, 'amount', p_amount), part.id);
  insert into public.bids (room_id, player_id, team_id, participant_id, amount, sequence, idempotency_key)
  values (p_room, pl.id, t.id, part.id, p_amount, seq, p_key) returning id into bid_id;
  return jsonb_build_object('bid_id', bid_id, 'amount', p_amount, 'sequence', seq, 'replay', false);
end $$;

create function public.host_action(p_room uuid, p_action text, p_arg uuid default null) returns text
language plpgsql security definer set search_path = public as $$
declare host public.participants := public.require_host(p_room); st public.auction_state; r public.rooms; res text := 'ok';
begin
  select * into st from public.auction_state where room_id = p_room for update;
  select * into r from public.rooms where id = p_room;
  if p_action = 'pause' then
    if st.status <> 'live' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.auction_state set status = 'paused',
      paused_remaining_ms = greatest(0, (extract(epoch from (deadline_at - now())) * 1000)::bigint), deadline_at = null where room_id = p_room;
    update public.rooms set status = 'paused' where id = p_room;
  elsif p_action = 'resume' then
    if st.status <> 'paused' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.auction_state set status = 'live',
      deadline_at = now() + (greatest(st.paused_remaining_ms, 3000) || ' milliseconds')::interval, paused_remaining_ms = null where room_id = p_room;
    update public.rooms set status = 'active' where id = p_room;
  elsif p_action = 'skip' then        -- send current lot to the back of the queue, discarding its bids' lead
    if st.status not in ('live','paused') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.players set status = 'upcoming', sort_order = (select coalesce(max(sort_order), 0) + 1 from public.players) where id = st.current_player_id;
    update public.auction_state set status = 'idle', current_player_id = null, deadline_at = null, paused_remaining_ms = null,
      current_bid = null, leading_team_id = null, leading_participant_id = null where room_id = p_room;
    update public.rooms set status = 'active' where id = p_room;
  elsif p_action = 'unsold' then
    if st.status not in ('live','paused') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.players set status = 'unsold' where id = st.current_player_id;
    update public.auction_state set status = 'idle', current_player_id = null, deadline_at = null, paused_remaining_ms = null,
      current_bid = null, leading_team_id = null, leading_participant_id = null where room_id = p_room;
    update public.rooms set status = 'active' where id = p_room;
  elsif p_action = 'reauction' then
    if st.status <> 'idle' then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    update public.players set status = 'upcoming' where room_id = p_room and status = 'unsold' and (p_arg is null or id = p_arg);
    if r.status = 'completed' then update public.rooms set status = 'active' where id = p_room; end if;
  elsif p_action = 'complete' then
    if st.status <> 'idle' then raise exception 'LOT_ALREADY_LIVE' using errcode = 'P0001'; end if;
    update public.rooms set status = 'completed' where id = p_room;
  elsif p_action = 'close' then
    if st.status = 'live' then perform public.finalize_lot(p_room, true); end if;
    update public.auction_state set status = 'idle', deadline_at = null where room_id = p_room;
    update public.rooms set status = 'closed' where id = p_room;
  else
    raise exception 'UNKNOWN_ACTION' using errcode = 'P0001';
  end if;
  perform public.log_event(p_room, 'host_' || p_action, '{}', host.id);
  return res;
end $$;

-- Member-callable and safe: only finalizes when the SERVER deadline has passed. Fallback if the scheduler lags.
create function public.sync_room(p_room uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_member(p_room) then raise exception 'NOT_MEMBER' using errcode = 'P0001'; end if;
  return public.finalize_lot(p_room, false);
end $$;

-- Trusted scheduler entry point (pg_cron / service role only). Idempotent.
create function public.finalize_expired_lots() returns int
language plpgsql security definer set search_path = public as $$
declare rec record; n int := 0;
begin
  for rec in select room_id from public.auction_state where status = 'live' and deadline_at <= now() for update skip locked loop
    if public.finalize_lot(rec.room_id, false) in ('sold','unsold') then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ---------- function privileges ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_room(text, text, text[], jsonb), public.join_room(text, text),
  public.claim_team(uuid), public.release_team(uuid), public.import_players(uuid, jsonb),
  public.start_next_lot(uuid), public.place_bid(uuid, numeric, text), public.host_action(uuid, text, uuid),
  public.sync_room(uuid), public.server_time() to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;
grant execute on function public.finalize_expired_lots() to service_role;

-- ---------- realtime ----------
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['rooms','participants','teams','players','auction_state','bids'] loop
      execute format('alter publication supabase_realtime add table public.%I', t);
    end loop;
  end if;
end $$;
