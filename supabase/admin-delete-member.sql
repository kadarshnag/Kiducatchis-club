-- Kiducatchis Admin Delete Member Function & Permissions
-- Run this script in the Supabase SQL Editor.
-- Permanently deletes a player or member profile, removing all foreign-key references
-- and removing the authentication user (if an account exists). Admin only.

create or replace function public.admin_delete_member(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
  caller_id uuid := auth.uid();
begin
  -- Ensure caller is an active administrator
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  -- Prevent admin self-deletion
  if p_id = caller_id then
    raise exception 'You cannot delete your own admin account';
  end if;

  if p_id is null then
    raise exception 'Member ID is required';
  end if;

  -- 1. Remove player from all tournament rosters
  delete from public.tournament_roster where player_id = p_id;

  -- 2. Remove match events where this player scored or assisted
  delete from public.match_events where player_id = p_id or assist_id = p_id;

  -- 3. Reassign match events created/recorded by this member to the deleting admin
  update public.match_events set created_by = caller_id where created_by = p_id;

  -- 4. Clean up finance transactions referencing this player
  delete from public.finance_transactions where player_id = p_id;
  update public.finance_transactions set created_by = caller_id where created_by = p_id;

  -- If this member was a cash holder, safely reassign or clean up
  update public.finance_transactions
    set holder_id = caller_id
    where holder_id = p_id and (transferred_to_id is null or transferred_to_id <> caller_id);
  delete from public.finance_transactions
    where holder_id = p_id or transferred_to_id = p_id;

  -- 5. Delete posts authored by this member
  delete from public.posts where author_id = p_id;

  -- 6. Delete strategies authored by this member
  delete from public.strategies where author_id = p_id;

  -- 7. Clean up invitations issued or used by this member
  delete from public.invitations where created_by = p_id or used_by = p_id;
  delete from public.member_email_invites where auth_user_id = p_id;

  -- 8. Delete the member's profile record
  delete from public.profiles where id = p_id;

  -- 9. Delete the auth.users account (if one exists), freeing the email to be re-invited
  delete from auth.users where id = p_id;
end $$;

revoke all on function public.admin_delete_member(uuid) from public;
grant execute on function public.admin_delete_member(uuid) to authenticated;

-- Grant delete permission and policy on public.profiles to authenticated admins
grant delete on public.profiles to authenticated;

drop policy if exists "admins can delete profiles" on public.profiles;
create policy "admins can delete profiles" on public.profiles for delete to authenticated
  using (public.is_admin() and id <> (select auth.uid()));
