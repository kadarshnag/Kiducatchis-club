-- Kiducatchis direct invitations / roster-only players update.
-- For an EXISTING database: run this file ONCE in Supabase SQL Editor.
-- Do NOT rerun schema.sql, which creates initial policies and indexes.

alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column if not exists is_guest boolean not null default false;

-- Email invitations are issued from the server-side Supabase Edge Function only.
-- A record is created just before calling auth.admin.inviteUserByEmail().
create table if not exists public.member_email_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  role text not null check(role in ('admin','council','player')),
  position text not null default 'Flexible' check(position in ('Handler','Cutter','Flexible')),
  jersey_number integer check(jersey_number between 0 and 999),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 day'),
  consumed_at timestamptz,
  auth_user_id uuid
);
create index if not exists member_email_invites_email_idx on public.member_email_invites(lower(email));
alter table public.member_email_invites enable row level security;
revoke all on public.member_email_invites from anon, authenticated;
grant all on public.member_email_invites to service_role;

-- Invite-only signups; never trust client-controlled user_metadata for roles.
create or replace function public.handle_new_member() returns trigger language plpgsql security definer set search_path = '' as $$
declare inv public.member_email_invites%rowtype;
begin
  select * into inv from public.member_email_invites
  where lower(email)=lower(new.email) and consumed_at is null and expires_at>now()
  order by created_at desc limit 1 for update;
  if not found then raise exception 'An administrator must send an email invitation first'; end if;
  insert into public.profiles(id,full_name,role,position,jersey_number,is_guest)
    values(new.id,inv.full_name,inv.role,inv.position,inv.jersey_number,false);
  update public.member_email_invites set consumed_at=now(),auth_user_id=new.id where id=inv.id;
  return new;
end $$;
drop trigger if exists on_kiducatchis_auth_signup on auth.users;
create trigger on_kiducatchis_auth_signup after insert on auth.users
  for each row execute function public.handle_new_member();

-- Profiles without Auth users are squad-only players; the administrator manages them.
create or replace function public.admin_create_squad_player(p_name text,p_position text default 'Flexible',p_number integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120 then raise exception 'Enter a valid player name'; end if;
  if p_position not in ('Handler','Cutter','Flexible') then raise exception 'Invalid position'; end if;
  if p_number is not null and (p_number < 0 or p_number > 999) then raise exception 'Invalid jersey number'; end if;
  insert into public.profiles(full_name,role,position,jersey_number,is_guest)
    values(trim(p_name),'player',p_position,p_number,true) returning id into new_id;
  return new_id;
end $$;
revoke all on function public.admin_create_squad_player(text,text,integer) from public;
grant execute on function public.admin_create_squad_player(text,text,integer) to authenticated;



-- Retain admin_update_member's existing signature; prevent guest profile promotion.
create or replace function public.admin_update_member(p_id uuid,p_role text,p_position text,p_number integer,p_title text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 if p_role not in ('admin','council','player') or p_position not in ('Handler','Cutter','Flexible') then raise exception 'Invalid role or position'; end if;
 if p_number is not null and (p_number<0 or p_number>999) then raise exception 'Invalid jersey number'; end if;
 if exists(select 1 from public.profiles where id=p_id and is_guest=true) and p_role<>'player' then raise exception 'Squad-only players cannot be promoted until invited with a login'; end if;
 if p_id=(select auth.uid()) and (p_role<>'admin' or not p_active) then raise exception 'You cannot demote or deactivate yourself'; end if;
 update public.profiles set role=p_role,position=p_position,jersey_number=p_number,council_title=p_title,is_active=p_active where id=p_id;
end $$;
revoke all on function public.admin_update_member(uuid,text,text,integer,text,boolean) from public;
grant execute on function public.admin_update_member(uuid,text,text,integer,text,boolean) to authenticated;


-- Internal conversion: preserve a squad-only player's historical roster/game/account references
-- when the administrator later invites that player to activate an account.
create or replace function public.internal_link_guest_player(p_guest uuid,p_account uuid)
returns void language plpgsql security definer set search_path='' as $$
declare guest public.profiles%rowtype;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'Server-only function';
  end if;
  select * into guest from public.profiles where id=p_guest for update;
  if not found or guest.is_guest is not true or guest.role <> 'player' then raise exception 'Squad-only player not found'; end if;
  if not exists(select 1 from public.profiles where id=p_account and is_guest=false and role='player') then
    raise exception 'Destination player login profile not found';
  end if;
  if p_guest=p_account then raise exception 'Cannot merge a profile into itself'; end if;
  -- Preserve profile bio/photo and all related records in the same database transaction.
  update public.profiles set bio=guest.bio,avatar_path=guest.avatar_path where id=p_account;
  update public.tournament_roster set player_id=p_account where player_id=p_guest;
  update public.match_events set player_id=p_account where player_id=p_guest;
  update public.match_events set assist_id=p_account where assist_id=p_guest;
  update public.finance_transactions set player_id=p_account where player_id=p_guest;
  delete from public.profiles where id=p_guest;
end $$;
revoke all on function public.internal_link_guest_player(uuid,uuid) from public;
grant execute on function public.internal_link_guest_player(uuid,uuid) to service_role;
