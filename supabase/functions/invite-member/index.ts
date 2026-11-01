// Supabase Edge Function: invite-member
// Service key remains inside Supabase, NEVER in Render/Vite or this repository.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const json = (data: unknown, status = 200, origin = '*') => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' },
});

Deno.serve(async (req: Request) => {
  const appUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
  const allowedOrigins = [appUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
  const requestOrigin = req.headers.get('origin') || '';
  const origin = allowedOrigins.includes(requestOrigin) ? requestOrigin : (appUrl || 'null');
  if (req.method === 'OPTIONS') return json({}, 200, origin);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) return json({ error: 'Origin not permitted' }, 403, origin);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || !appUrl) throw new Error('Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and APP_URL in Supabase secrets.');
    const bearer = req.headers.get('authorization') || '';
    if (!bearer.toLowerCase().startsWith('bearer ')) return json({ error: 'Please sign in first.' }, 401, origin);
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth, error: authError } = await supabase.auth.getUser(bearer.slice(7).trim());
    if (authError || !auth.user) return json({ error: 'Invalid session' }, 401, origin);
    const { data: caller, error: roleError } = await supabase.from('profiles')
      .select('role,is_active,is_guest').eq('id', auth.user.id).maybeSingle();
    if (roleError || !caller || !['admin', 'council'].includes(caller.role) || !caller.is_active || caller.is_guest)
      return json({ error: 'Active Admin or Council access required' }, 403, origin);

    const body = await req.json();
    if (body.action === 'delete_member') {
      if (caller.role !== 'admin') return json({ error: 'Only administrators can delete members.' }, 403, origin);
      const targetId = String(body.member_id || '').trim();
      if (!targetId) return json({ error: 'Member ID required.' }, 400, origin);
      if (targetId === auth.user.id) return json({ error: 'You cannot delete your own admin account.' }, 400, origin);

      await supabase.from('tournament_roster').delete().eq('player_id', targetId);
      await supabase.from('match_events').delete().eq('player_id', targetId);
      await supabase.from('match_events').delete().eq('assist_id', targetId);
      await supabase.from('finance_transactions').delete().eq('player_id', targetId);

      const { error: profileError } = await supabase.from('profiles').delete().eq('id', targetId);
      try {
        await supabase.auth.admin.deleteUser(targetId);
      } catch (_) {
        // Player might be a squad guest without an Auth account
      }
      if (profileError) return json({ error: profileError.message }, 400, origin);
      return json({ ok: true, message: 'Member deleted.' }, 200, origin);
    }
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim();
    const role = String(body.role || 'player');
    const position = String(body.position || 'Flexible');
    const guestProfileId = body.guest_profile_id ? String(body.guest_profile_id) : null;
    const rawJersey = body.jersey_number;
    const jersey = rawJersey === '' || rawJersey === null || rawJersey === undefined ? null : Number(rawJersey);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400, origin);
    if (fullName.length < 2 || fullName.length > 120) return json({ error: 'Enter a full name (2–120 characters).' }, 400, origin);
    if (!['player', 'council', 'admin'].includes(role) || !['Handler', 'Cutter', 'Flexible'].includes(position) ||
        (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 999)))
      return json({ error: 'Invalid role, position or jersey number.' }, 400, origin);
    if (caller.role !== 'admin' && role !== 'player')
      return json({ error: 'Only an administrator can invite council members or administrators.' }, 403, origin);

    // Optional upgrade from squad-only to login-enabled profile; the server owns the
    // existing player details and migrates related records transactionally.
    let guest: { id: string; full_name: string; role: string; is_guest: boolean; is_active: boolean; position: string; jersey_number: number | null } | null = null;
    if (guestProfileId) {
      const { data: old, error: oldError } = await supabase.from('profiles')
        .select('id,full_name,role,is_guest,is_active,position,jersey_number').eq('id', guestProfileId).maybeSingle();
      if (oldError) throw oldError;
      if (!old || !old.is_guest || !old.is_active || old.role !== 'player' || role !== 'player')
        return json({ error: 'Select an active squad-only player for the login upgrade.' }, 400, origin);
      guest = old;
    }
    const invitedName = guest?.full_name || fullName;
    const invitedPosition = guest?.position || position;
    const invitedJersey = guest ? guest.jersey_number : jersey;
    async function linkGuest(accountId: string) {
      if (!guest) return;
      const { error } = await supabase.rpc('internal_link_guest_player', { p_guest: guest.id, p_account: accountId });
      if (error) throw new Error(`Invitation account created but squad history migration failed: ${error.message}`);
    }

    // Repair users created previously in Authentication who do not have a member profile.
    // Auth admin API does not provide lookup by email, so paginate existing users.
    let existing: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      existing = data.users.find(u => u.email?.toLowerCase() === email);
      if (existing || data.users.length < 200) break;
    }
    if (existing) {
      const { data: current, error: currentError } = await supabase.from('profiles').select('id').eq('id', existing.id).maybeSingle();
      if (currentError) throw currentError;
      if (current) return json({ error: 'This account already has a profile. Edit it in Members instead.' }, 409, origin);
      const { error: createError } = await supabase.from('profiles').insert({
        id: existing.id, full_name: invitedName, role, position: invitedPosition, jersey_number: invitedJersey, is_active: true, is_guest: false,
      });
      if (createError) throw createError;
      await linkGuest(existing.id);
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/activate` });
      if (sendError) return json({ error: `Profile created, but the activation email failed: ${sendError.message}. You may retry using Supabase Authentication.` }, 502, origin);
      return json({ ok: true, status: 'repaired', message: 'Profile created and activation email sent.' }, 200, origin);
    }

    // The trigger reads this trusted record. User-supplied auth metadata cannot grant roles.
    const { data: intent, error: intentError } = await supabase.from('member_email_invites').insert({
      email, full_name: invitedName, role, position: invitedPosition, jersey_number: invitedJersey,
    }).select('id').single();
    if (intentError) throw intentError;
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/activate`,
    });
    if (inviteError) {
      await supabase.from('member_email_invites').delete().eq('id', intent.id);
      return json({ error: inviteError.message }, 400, origin);
    }
    if (!invited.user?.id) return json({ error: 'Email invitation did not create an Auth user.' }, 502, origin);
    // The Auth trigger creates this profile before the invite API returns.
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', invited.user.id).maybeSingle();
    if (!profile) return json({ error: 'Auth invitation created, but the profile was not provisioned. Check the signup trigger in Supabase.' }, 502, origin);
    await linkGuest(invited.user.id);
    return json({ ok: true, status: 'invited', message: 'Member profile created and an invitation email sent.' }, 200, origin);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unable to send invitation.' }, 500, origin);
  }
});