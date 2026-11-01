// Supabase Edge Function: invite-member
// Service key remains inside Supabase, NEVER in Render/Vite or this repository.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const json = (data: unknown, status = 200, origin = '*') => new Response(JSON.stringify(data), {
  status, headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  },
});

Deno.serve(async (req: Request) => {
  const requestOrigin = req.headers.get('origin') || '';
  const configuredAppUrl = (Deno.env.get('APP_URL') || '').replace(/\/$/, '');
  const appUrl = configuredAppUrl || requestOrigin || 'http://localhost:5173';
  const origin = requestOrigin || configuredAppUrl || '*';

  if (req.method === 'OPTIONS') return json({}, 200, origin);
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Supabase secrets.');

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

    // ACTION: DELETE MEMBER
    if (body.action === 'delete_member') {
      if (caller.role !== 'admin') return json({ error: 'Only administrators can delete members.' }, 403, origin);
      const targetId = String(body.member_id || '').trim();
      if (!targetId) return json({ error: 'Member ID required.' }, 400, origin);
      if (targetId === auth.user.id) return json({ error: 'You cannot delete your own admin account.' }, 400, origin);

      // Clean up all foreign key references before deleting profile
      await supabase.from('tournament_roster').delete().eq('player_id', targetId);
      await supabase.from('match_events').delete().eq('player_id', targetId);
      await supabase.from('match_events').delete().eq('assist_id', targetId);
      await supabase.from('match_events').update({ created_by: auth.user.id }).eq('created_by', targetId);

      await supabase.from('finance_transactions').delete().eq('player_id', targetId);
      await supabase.from('finance_transactions').update({ created_by: auth.user.id }).eq('created_by', targetId);
      await supabase.from('finance_transactions').update({ holder_id: auth.user.id }).eq('holder_id', targetId);
      await supabase.from('finance_transactions').delete().eq('holder_id', targetId);
      await supabase.from('finance_transactions').delete().eq('transferred_to_id', targetId);

      await supabase.from('posts').delete().eq('author_id', targetId);
      await supabase.from('strategies').delete().eq('author_id', targetId);
      await supabase.from('invitations').delete().eq('created_by', targetId);
      await supabase.from('invitations').delete().eq('used_by', targetId);
      await supabase.from('member_email_invites').delete().eq('auth_user_id', targetId);

      const { error: profileError } = await supabase.from('profiles').delete().eq('id', targetId);
      try {
        await supabase.auth.admin.deleteUser(targetId);
      } catch (_) {
        // Player might be a squad guest without an Auth account
      }
      if (profileError) return json({ error: profileError.message }, 400, origin);
      return json({ ok: true, message: 'Member deleted.' }, 200, origin);
    }

    // ACTION: RESEND INVITATION / GENERATE ACTIVATION LINK
    if (body.action === 'resend_invite') {
      if (caller.role !== 'admin') return json({ error: 'Only administrators can manage invitations.' }, 403, origin);
      const targetId = String(body.member_id || '').trim();
      let targetEmail = String(body.email || '').trim().toLowerCase();

      if (!targetEmail && targetId) {
        const { data: u } = await supabase.auth.admin.getUserById(targetId);
        targetEmail = u?.user?.email?.toLowerCase() || '';
        if (!targetEmail) {
          const { data: inv } = await supabase.from('member_email_invites')
            .select('email').eq('auth_user_id', targetId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          targetEmail = inv?.email?.toLowerCase() || '';
        }
      }
      if (!targetEmail) return json({ error: 'Member email address not found.' }, 400, origin);

      let directLink = '';
      try {
        const { data: linkRes } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: targetEmail,
          options: { redirectTo: `${appUrl}/activate` }
        });
        if (linkRes?.properties?.action_link) directLink = linkRes.properties.action_link;
      } catch (_) {}

      let emailErr = '';
      try {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, { redirectTo: `${appUrl}/activate` });
        if (resetErr) emailErr = resetErr.message;
      } catch (e) {
        emailErr = e instanceof Error ? e.message : 'Email delivery failed';
      }

      return json({
        ok: true,
        message: emailErr ? `Activation link generated (Email notice: ${emailErr}).` : `Activation email sent to ${targetEmail}.`,
        invite_link: directLink,
        email: targetEmail
      }, 200, origin);
    }

    // DEFAULT ACTION: CREATE AND INVITE MEMBER
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim();
    const role = String(body.role || 'player');
    const position = String(body.position || 'Flexible');
    const guestProfileId = body.guest_profile_id ? String(body.guest_profile_id) : null;
    const rawJersey = body.jersey_number;
    const jersey = rawJersey === '' || rawJersey === null || rawJersey === undefined ? null : Number(rawJersey);
    const councilTitle = body.council_title ? String(body.council_title).trim() : null;
    const bio = body.bio ? String(body.bio).trim() : null;
    const inSquad = Boolean(body.in_squad);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400, origin);
    if (fullName.length < 2 || fullName.length > 120) return json({ error: 'Enter a full name (2–120 characters).' }, 400, origin);
    if (!['player', 'council', 'admin'].includes(role) || !['Handler', 'Cutter', 'Flexible'].includes(position) ||
        (jersey !== null && (!Number.isInteger(jersey) || jersey < 0 || jersey > 999)))
      return json({ error: 'Invalid role, position or jersey number.' }, 400, origin);
    if (caller.role !== 'admin' && role !== 'player')
      return json({ error: 'Only an administrator can invite council members or administrators.' }, 403, origin);

    // Optional upgrade from squad-only to login-enabled profile
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

    // Check existing users in auth
    let existing: { id: string; email?: string } | undefined;
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      existing = data.users.find(u => u.email?.toLowerCase() === email);
      if (existing || data.users.length < 200) break;
    }

    if (existing) {
      let { data: current, error: currentError } = await supabase.from('profiles').select('id').eq('id', existing.id).maybeSingle();
      if (currentError) throw currentError;

      if (!current) {
        const { error: createError } = await supabase.from('profiles').insert({
          id: existing.id,
          full_name: invitedName,
          role,
          position: invitedPosition,
          jersey_number: invitedJersey,
          council_title: councilTitle,
          bio,
          in_squad: inSquad,
          is_active: true,
          is_guest: false,
        });
        if (createError) throw createError;
      } else {
        await supabase.from('profiles').update({
          full_name: invitedName,
          role,
          position: invitedPosition,
          jersey_number: invitedJersey,
          council_title: councilTitle,
          bio,
          in_squad: inSquad,
          is_active: true
        }).eq('id', existing.id);
      }

      await linkGuest(existing.id);

      let inviteLink = '';
      try {
        const { data: linkRes } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: `${appUrl}/activate` }
        });
        if (linkRes?.properties?.action_link) inviteLink = linkRes.properties.action_link;
      } catch (_) {}

      let sendWarn = '';
      try {
        const { error: sendError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl}/activate` });
        if (sendError) sendWarn = sendError.message;
      } catch (e) {
        sendWarn = e instanceof Error ? e.message : 'Email failed';
      }

      return json({
        ok: true,
        status: 'repaired',
        message: sendWarn
          ? `Profile linked. Direct activation link ready (Email notice: ${sendWarn}).`
          : 'Profile linked and activation email sent.',
        invite_link: inviteLink
      }, 200, origin);
    }

    // New user signup flow: insert into member_email_invites for security definer trigger
    const { data: intent, error: intentError } = await supabase.from('member_email_invites').insert({
      email, full_name: invitedName, role, position: invitedPosition, jersey_number: invitedJersey,
    }).select('id').single();
    if (intentError) throw intentError;

    let createdUserId = '';
    let inviteLink = '';
    let emailSent = false;
    let emailWarning = '';

    // First attempt: inviteUserByEmail
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${appUrl}/activate`,
    });

    if (!inviteError && invited?.user?.id) {
      createdUserId = invited.user.id;
      emailSent = true;
      try {
        const { data: linkData } = await supabase.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo: `${appUrl}/activate` }
        });
        if (linkData?.properties?.action_link) inviteLink = linkData.properties.action_link;
      } catch (_) {}
    } else {
      // Fallback: If inviteUserByEmail hits rate limit or SMTP error, use generateLink
      emailWarning = inviteError?.message || 'Email delivery limit reached';
      const { data: genData, error: genError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email,
        options: { redirectTo: `${appUrl}/activate` }
      });

      if (genError || !genData?.user?.id) {
        await supabase.from('member_email_invites').delete().eq('id', intent.id);
        return json({ error: inviteError?.message || genError?.message || 'Unable to create user invitation.' }, 400, origin);
      }
      createdUserId = genData.user.id;
      inviteLink = genData.properties?.action_link || '';
    }

    // Ensure profile row exists (provision directly if the signup trigger did not run)
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', createdUserId).maybeSingle();
    if (!profile) {
      await supabase.from('profiles').upsert({
        id: createdUserId,
        full_name: invitedName,
        role,
        position: invitedPosition,
        jersey_number: invitedJersey,
        council_title: councilTitle,
        bio,
        in_squad: inSquad,
        is_active: true,
        is_guest: false,
      });
    } else {
      await supabase.from('profiles').update({
        council_title: councilTitle,
        bio,
        in_squad: inSquad
      }).eq('id', createdUserId);
    }

    await linkGuest(createdUserId);

    const message = emailSent
      ? 'Member profile created and invitation email sent.'
      : 'Member account created! Direct activation link is ready below.';

    return json({
      ok: true,
      status: 'invited',
      message,
      invite_link: inviteLink,
      email_warning: emailWarning || undefined
    }, 200, origin);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unable to send invitation.' }, 500, origin);
  }
});