-- Optional SQL helper: run in Supabase SQL editor if desired.
-- Deletes a player or member profile and associated records. Admin only.

create or replace function public.admin_delete_member(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_id = (select auth.uid()) then raise exception 'You cannot delete your own admin account'; end if;

  delete from public.tournament_roster where player_id = p_id;
  delete from public.match_events where player_id = p_id or assist_id = p_id;
  delete from public.finance_transactions where player_id = p_id;
  delete from public.profiles where id = p_id;
end $$;
revoke all on function public.admin_delete_member(uuid) from public;
grant execute on function public.admin_delete_member(uuid) to authenticated;
