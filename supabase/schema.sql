-- KIDUCATCHIS • one-time setup in Supabase SQL Editor.
-- IMPORTANT: Create the first user at Authentication > Users BEFORE running this file.
-- Afterwards run supabase/bootstrap-admin.sql with your first user's email.
-- Signups after setup require an invitation and matching email.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Club member',
  role text not null default 'player' check (role in ('admin','council','player')),
  position text not null default 'Flexible' check (position in ('Handler','Cutter','Flexible')),
  jersey_number integer check (jersey_number between 0 and 999),
  council_title text,
  avatar_path text,
  bio text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  role text not null check(role in ('admin','council','player')),
  token text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id),
  expires_at timestamptz not null default (now()+interval '14 days'),
  constraint invite_token_length check(length(token)>=32)
);
-- Multiple pending invitations are allowed; older expired codes do not block reissuing.

create or replace function public.user_role() returns text language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id=(select auth.uid()) and is_active=true limit 1
$$;
create or replace function public.is_core() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.user_role() in ('admin','council')),false)
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.user_role()='admin'),false)
$$;

-- Profiles of users created from the Auth dashboard before the schema are seeded by bootstrap-admin.sql.
-- Future signup uses invitation token supplied through signUp({options:{data:{invite_code}}}).
create or replace function public.handle_new_member() returns trigger language plpgsql security definer set search_path = '' as $$
declare inv public.invitations%rowtype;
begin
  select * into inv from public.invitations
  where lower(email)=lower(new.email) and token=(new.raw_user_meta_data->>'invite_code')
    and used_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Valid invitation required for this email'; end if;
  insert into public.profiles(id,full_name,role) values
    (new.id,coalesce(nullif(inv.full_name,''),split_part(new.email,'@',1)),inv.role);
  update public.invitations set used_at=now(),used_by=new.id where id=inv.id;
  return new;
end $$;
drop trigger if exists on_kiducatchis_auth_signup on auth.users;
create trigger on_kiducatchis_auth_signup after insert on auth.users for each row execute function public.handle_new_member();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  type text not null default 'blog' check (type in ('blog','photo')),
  title text not null,
  body text not null default '',
  image_path text,
  images jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  location text,
  starts_on date not null,
  ends_on date,
  status text not null default 'upcoming' check(status in ('upcoming','ongoing','completed')),
  created_at timestamptz not null default now()
);
create table if not exists public.tournament_roster (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  player_id uuid not null references public.profiles(id),
  position text not null default 'Flexible' check(position in ('Handler','Cutter','Flexible')),
  team_role text not null default 'Player' check(team_role in ('Player','Captain','Spirit Captain','Coach','Vice Captain','Manager')),
  jersey_number integer check(jersey_number between 0 and 999),
  unique(tournament_id,player_id)
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  opponent text not null,
  venue text,
  scheduled_at timestamptz not null,
  status text not null default 'upcoming' check(status in ('upcoming','live','completed')),
  score_us integer not null default 0,
  score_them integer not null default 0,
  pinned boolean not null default false,
  clock_running boolean not null default false,
  clock_started_at timestamptz,
  elapsed_before_pause integer not null default 0 check(elapsed_before_pause>=0),
  notes text default '',
  created_at timestamptz not null default now()
);
create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  kind text not null check(kind in ('point_us','point_them','block','turnover','on','off','other')),
  player_id uuid references public.profiles(id),
  assist_id uuid references public.profiles(id),
  game_second integer not null default 0 check(game_second>=0),
  detail text default '',
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id)
);

create or replace function public.validate_match_event() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
  select tournament_id into tid from public.matches where id=new.match_id;
  if tid is null then raise exception 'Match not found'; end if;
  if new.player_id is not null and not exists(select 1 from public.tournament_roster where tournament_id=tid and player_id=new.player_id) then
     raise exception 'Selected player is not on tournament roster';
  end if;
  if new.assist_id is not null and (new.kind <> 'point_us' or not exists(select 1 from public.tournament_roster where tournament_id=tid and player_id=new.assist_id)) then
     raise exception 'Assist must belong to roster on our point';
  end if;
  if new.kind='point_us' and new.player_id is null then raise exception 'Select the scorer'; end if;
  if new.assist_id is not null and new.assist_id=new.player_id then raise exception 'Scorer and assister must differ'; end if;
  if (select status from public.matches where id=new.match_id) <> 'live' then raise exception 'Match must be live to record an event'; end if;
  return new;
end $$;
drop trigger if exists validate_kiducatchis_event on public.match_events;
create trigger validate_kiducatchis_event before insert on public.match_events for each row execute function public.validate_match_event();

create or replace function public.recalculate_score() returns trigger language plpgsql security definer set search_path='' as $$
declare mid uuid;
begin
  mid:=coalesce(new.match_id,old.match_id);
  update public.matches set
    score_us=(select count(*) from public.match_events where match_id=mid and kind='point_us'),
    score_them=(select count(*) from public.match_events where match_id=mid and kind='point_them')
  where id=mid;
  return null;
end $$;
drop trigger if exists update_kiducatchis_score on public.match_events;
create trigger update_kiducatchis_score after insert or delete on public.match_events for each row execute function public.recalculate_score();

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  title text not null,
  description text default '',
  media_path text,
  media_type text check(media_type in ('image','video','whiteboard','link','other')),
  snapshot_path text,
  link_url text,
  created_at timestamptz not null default now()
);
create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('income','expense','transfer')),
  amount numeric(12,2) not null check(amount>0),
  scope text not null default 'club' check(scope in ('club','player')),
  player_id uuid references public.profiles(id),
  holder_id uuid not null references public.profiles(id),
  transferred_to_id uuid references public.profiles(id),
  reason text not null,
  proof_path text,
  occurred_on date not null default current_date,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint transfer_to_different_member check(kind<>'transfer' or (transferred_to_id is not null and transferred_to_id<>holder_id)),
  constraint player_scope_has_player check(scope<>'player' or player_id is not null)
);
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(name) between 1 and 120),
  email text not null check(length(email) between 3 and 255),
  message text not null check(length(message) between 4 and 5000),
  created_at timestamptz not null default now()
);

-- Explicit API privileges. The RLS policies below decide which rows each role can reach.
-- For profiles/posts, use the column-level write grants configured later to protect roles/pins.
grant usage on schema public to anon, authenticated;
grant select on public.profiles,public.posts,public.tournaments,public.tournament_roster,public.matches,public.match_events to anon,authenticated;
grant select,insert,update,delete on public.invitations to authenticated;
grant delete on public.posts to authenticated;
grant insert,update,delete on public.tournaments,public.tournament_roster,public.matches to authenticated;
grant insert,delete on public.match_events to authenticated;
grant select,insert,delete on public.strategies to authenticated;
grant select,insert,update,delete on public.finance_transactions to authenticated;
grant insert on public.contact_messages to anon,authenticated;
grant select,delete on public.contact_messages to authenticated;

-- Mark sensitive tables as RLS-secured. Neither the publishable key nor the UI grants access.
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.posts enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_roster enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.strategies enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.contact_messages enable row level security;

-- Profiles: public read; own basic details only, role/admin fields only through protected RPC.
create policy "profiles readable by everyone" on public.profiles for select to anon,authenticated using(true);
create policy "member edits own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
revoke update on public.profiles from authenticated;
grant update (full_name, position, jersey_number, avatar_path, bio) on public.profiles to authenticated;
grant delete on public.profiles to authenticated;
create policy "admins can delete profiles" on public.profiles for delete to authenticated using(public.is_admin() and id<>(select auth.uid()));

create or replace function public.admin_update_member(p_id uuid,p_role text,p_position text,p_number integer,p_title text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 if p_role not in ('admin','council','player') or p_position not in ('Handler','Cutter','Flexible') then raise exception 'Invalid role or position'; end if;
 if p_number is not null and (p_number<0 or p_number>999) then raise exception 'Invalid jersey number'; end if;
 if p_id=(select auth.uid()) and (p_role<>'admin' or not p_active) then raise exception 'You cannot demote or deactivate yourself'; end if;
 update public.profiles set role=p_role,position=p_position,jersey_number=p_number,council_title=p_title,is_active=p_active where id=p_id;
end $$;
revoke all on function public.admin_update_member(uuid,text,text,integer,text,boolean) from public;
grant execute on function public.admin_update_member(uuid,text,text,integer,text,boolean) to authenticated;

create or replace function public.admin_delete_member(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  caller_id uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_id = caller_id then raise exception 'You cannot delete your own admin account'; end if;
  if p_id is null then raise exception 'Member ID is required'; end if;

  delete from public.tournament_roster where player_id = p_id;
  delete from public.match_events where player_id = p_id or assist_id = p_id;
  update public.match_events set created_by = caller_id where created_by = p_id;
  delete from public.finance_transactions where player_id = p_id;
  update public.finance_transactions set created_by = caller_id where created_by = p_id;
  update public.finance_transactions set holder_id = caller_id where holder_id = p_id and (transferred_to_id is null or transferred_to_id <> caller_id);
  delete from public.finance_transactions where holder_id = p_id or transferred_to_id = p_id;
  delete from public.posts where author_id = p_id;
  delete from public.strategies where author_id = p_id;
  delete from public.invitations where created_by = p_id or used_by = p_id;
  delete from public.member_email_invites where auth_user_id = p_id;
  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end $$;
revoke all on function public.admin_delete_member(uuid) from public;
grant execute on function public.admin_delete_member(uuid) to authenticated;

create policy "admins manage invitations" on public.invitations for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "anyone can read published posts" on public.posts for select to anon,authenticated using(published=true or author_id=(select auth.uid()) or public.is_core());
create policy "members create own posts" on public.posts for insert to authenticated with check(author_id=(select auth.uid()) and exists(select 1 from public.profiles where id=auth.uid() and is_active));
create policy "authors or core edit posts" on public.posts for update to authenticated using((author_id=(select auth.uid()) and pinned=false) or public.is_core()) with check((author_id=(select auth.uid()) and pinned=false) or public.is_core());
create policy "authors or core delete posts" on public.posts for delete to authenticated using(author_id=(select auth.uid()) or public.is_core());
-- Non-core authors cannot change their authored posts to pinned by UPDATE (check above),
-- but can set pinned=true upon INSERT unless column privileges protect it.
revoke insert,update on public.posts from authenticated;
grant insert (author_id,type,title,body,image_path,images,published) on public.posts to authenticated;
-- Core pinning uses security-definer RPC to avoid granting pinned column globally.
grant update (title,body,image_path,images,published) on public.posts to authenticated;
create or replace function public.core_pin_post(p_id uuid,p_pin boolean) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_core() then raise exception 'Council only'; end if; update public.posts set pinned=p_pin where id=p_id; end $$;
revoke all on function public.core_pin_post(uuid,boolean) from public;
grant execute on function public.core_pin_post(uuid,boolean) to authenticated;

create policy "tournaments public read" on public.tournaments for select to anon,authenticated using(true);
create policy "core inserts tournaments" on public.tournaments for insert to authenticated with check(public.is_core());
create policy "core updates tournaments" on public.tournaments for update to authenticated using(public.is_core()) with check(public.is_core());
create policy "core deletes tournaments" on public.tournaments for delete to authenticated using(public.is_core());
create policy "tournament roster public read" on public.tournament_roster for select to anon,authenticated using(true);
create policy "core sets roster" on public.tournament_roster for insert to authenticated with check(public.is_core());
create policy "core edits roster" on public.tournament_roster for update to authenticated using(public.is_core()) with check(public.is_core());
create policy "core removes roster" on public.tournament_roster for delete to authenticated using(public.is_core());
create policy "matches public read" on public.matches for select to anon,authenticated using(true);
create policy "core creates matches" on public.matches for insert to authenticated with check(public.is_core());
create policy "core edits matches" on public.matches for update to authenticated using(public.is_core()) with check(public.is_core());
create policy "core deletes matches" on public.matches for delete to authenticated using(public.is_core());
create policy "events public read" on public.match_events for select to anon,authenticated using(true);
create policy "core enters events" on public.match_events for insert to authenticated with check(public.is_core() and created_by=(select auth.uid()));
create policy "core removes events" on public.match_events for delete to authenticated using(public.is_core());

create policy "signed in users view strategies" on public.strategies for select to authenticated using(public.user_role() is not null);
create policy "signed in users create strategies" on public.strategies for insert to authenticated with check(author_id=(select auth.uid()) and public.user_role() is not null);
create policy "author/core remove strategy" on public.strategies for delete to authenticated using(author_id=(select auth.uid()) or public.is_core());
create policy "core finance read" on public.finance_transactions for select to authenticated using(public.is_core());
create policy "core finance insert" on public.finance_transactions for insert to authenticated with check(public.is_core() and created_by=(select auth.uid()));
create policy "admin finance update" on public.finance_transactions for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin finance delete" on public.finance_transactions for delete to authenticated using(public.is_admin());
create policy "public contact create" on public.contact_messages for insert to anon,authenticated with check(true);
create policy "core contact read" on public.contact_messages for select to authenticated using(public.is_core());
create policy "admin contact delete" on public.contact_messages for delete to authenticated using(public.is_admin());

-- Finance rows must refer to current/actual core holders, not arbitrary player IDs.
create or replace function public.validate_finance_holder() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=new.holder_id and role in ('admin','council') and is_active=true) then raise exception 'Money holder must be an active council/admin member'; end if;
 if new.transferred_to_id is not null and not exists(select 1 from public.profiles where id=new.transferred_to_id and role in ('admin','council') and is_active=true) then raise exception 'Transfer recipient must be an active council/admin member'; end if;
 return new;
end $$;
drop trigger if exists validate_kiducatchis_finance on public.finance_transactions;
create trigger validate_kiducatchis_finance before insert or update on public.finance_transactions for each row execute function public.validate_finance_holder();

-- Storage: public club media; private game plans + financial proofs. First folder is uploader's user id.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('club-media','club-media',true,20971520,array['image/jpeg','image/png','image/webp','image/gif']),
('strategy-files','strategy-files',false,104857600,array['image/jpeg','image/png','image/webp','video/webm','video/mp4','application/pdf']),
('finance-proofs','finance-proofs',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;
create policy "public can read club media" on storage.objects for select to anon,authenticated using(bucket_id='club-media');
create policy "members upload club images" on storage.objects for insert to authenticated with check(bucket_id='club-media' and (storage.foldername(name))[1]=(select auth.uid())::text and public.user_role() is not null);
create policy "members remove own public uploads" on storage.objects for delete to authenticated using(bucket_id='club-media' and owner_id=(select auth.uid())::text);
create policy "members view private strategies" on storage.objects for select to authenticated using(bucket_id='strategy-files' and public.user_role() is not null);
create policy "members upload strategy files" on storage.objects for insert to authenticated with check(bucket_id='strategy-files' and (storage.foldername(name))[1]=(select auth.uid())::text and public.user_role() is not null);
create policy "members delete own strategies files" on storage.objects for delete to authenticated using(bucket_id='strategy-files' and owner_id=(select auth.uid())::text);
create policy "core view financial proofs" on storage.objects for select to authenticated using(bucket_id='finance-proofs' and public.is_core());
create policy "core upload proofs" on storage.objects for insert to authenticated with check(bucket_id='finance-proofs' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_core());
create policy "admin delete proofs" on storage.objects for delete to authenticated using(bucket_id='finance-proofs' and public.is_admin());

create index if not exists idx_posts_recent on public.posts(pinned desc,created_at desc);
create index if not exists idx_matches_recent on public.matches(status,scheduled_at desc);
create index if not exists idx_events_match on public.match_events(match_id,game_second desc);
create index if not exists idx_tx_date on public.finance_transactions(occurred_on desc);
create index if not exists idx_roster_tournament on public.tournament_roster(tournament_id);
create index if not exists idx_strategy_recent on public.strategies(created_at desc);

-- Realtime DB updates: convenient for one-club scoring; no dedicated websocket backend needed.
alter table public.match_events replica identity full;
alter table public.matches replica identity full;
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
   alter publication supabase_realtime add table public.matches;
 end if;
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events') then
   alter publication supabase_realtime add table public.match_events;
 end if;
end $$;
