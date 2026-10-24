# Kiducatchis — Ultimate Frisbee Club Website

A responsive public website plus protected club management platform. **React + Vite + Supabase only**, deployed as a **Render Static Site**. No custom Node/Express API, Prisma, PHP, or separate application server.

Includes the **actual user-supplied Kiducatchis jerseys, logos, and mascot**; purple/blue-black aesthetic; animated 1.5-second flying-disc intro (automatically removed with reduced-motion preferences).

## 1 — What is included

**Public visitors:** Home/featured live and pinned games, latest three featured stories, match history and event timelines, squad members, council, player profiles including tournament stats, photos, blogs, About, Contact, tournaments, full score history. Live scoring changes are streamed with Supabase Realtime.

**All signed-in members:** Dashboard, their editable player profile and picture, private strategy library (PDF/video/images), photo/gallery and blog publishing, and a canvas-based tactics whiteboard. The whiteboard **records drawings as a video** using `canvas.captureStream()` and `MediaRecorder`, saves to Supabase Storage, and is viewable by teammates. Supports static image fallback. No audio/camera is recorded.

**Council + admins:** Create tournaments, choose tournament-specific squads, assign positions (`Handler`, `Cutter`, `Flexible`) plus roles (`Captain`, `Spirit Captain`, `Coach`, `Vice Captain`, `Manager`, `Player`), jersey numbers, schedule matches, run/pause the game clock, record points, scorers, assists, blocks, turnovers, and player on/off events with game-clock timestamps, delete erroneous events, pin games to homepage. Access to club finances and contact inbox.

**Finances:** Income, expenses, internal transfers between council cash holders, player/club scope, reason, amount, date and optional private receipt/proof. Totals, monthly chart, net funds held per core member, ledger, CSV export. Only admins can delete transactions; council can record and view them.

**Admin only:** Issue expiring one-time member invites, set club roles, positions and jersey, assign council titles, deactivate/reactivate accounts. **No admin/service-role key is ever used by the browser.**

## 2 — Initialize Supabase (one-time)

1. Create a free Supabase project at https://supabase.com/dashboard.
2. Open **Authentication → Providers → Email**. Enable email authentication. **Keep email confirmation enabled** for member invitation signups. Configure your email sender or use Supabase's development limits while testing.
3. **Important:** BEFORE running SQL, visit **Authentication → Users → Add user** and create the initial administrator's email/password using the Supabase dashboard. This is the first, trusted user.
4. Open **SQL Editor**. Paste and run `supabase/schema.sql` once, using the SQL Editor's privileged database role. This creates tables, grants, RLS rules, functions, invitation enforcement, storage buckets, and Realtime publication settings.
5. Open `supabase/bootstrap-admin.sql`. Replace `YOUR_ADMIN_EMAIL@example.com` with that exact user's email, paste into SQL Editor and execute. Verify the final query returns your administrator with role `admin`.
6. Under **Authentication → URL Configuration**, set Site URL to your local site while developing (`http://localhost:5173`), then your Render URL for production. Add `http://localhost:5173/login` and `https://YOUR-SITE.onrender.com/login` to allowed Redirect URLs. You can add custom-domain URLs here later.
7. Open **Project Settings → API / Connect**. Copy your project URL and **publishable (`sb_publishable_...`) or legacy anon key**. **Never use `service_role` or secret keys in the frontend.**

**Run order is essential:** First create admin Auth user → run `schema.sql` → run `bootstrap-admin.sql`. Creating an Auth user AFTER the trigger is installed requires a valid invitation, even for admin-created users. The first bootstrap user is the deliberate exception because it was created before the trigger.

## 3 — Run locally

Requires a recent Node.js version (Node 22 recommended).

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

```bash
npm run dev
```

Open `http://localhost:5173` and log in at `/login` using the initial administrator.

Without environment variables the homepage still shows the supplied branding, but **database-backed content and sign-in are intentionally disabled**.

## 4 — Invite your players and council

1. Sign in as admin, choose **Dashboard → Members & invites**.
2. Enter the invited person's exact email, display name, and intended role. Click **GENERATE INVITE**.
3. Send the member the `/join` URL and invitation code privately (e.g., over the club's existing messaging channel). The app does not send invitation emails automatically. Codes expire after **14 days** and are single-use.
4. The invited member registers at `/join` with that same email and an 8+ character password. They confirm their email, then sign in at `/login`.
5. The admin may edit that person's position, jersey number, club role, council title, and active status. Player-specific tournament roles are managed separately in **Tournaments**.

A player cannot self-promote to council/admin. RLS and an admin-only Postgres RPC protect the role field. There is no open public account registration.

## 5 — Creating a tournament and running a live game

1. As council/admin, open **Tournaments**, create the competition and select its squad (or add players afterwards).
2. Choose that tournament; set individual jersey numbers, Handler/Cutter/Flexible, Captain/Spirit Captain/Coach etc. **Save each changed roster row** with its check icon.
3. Schedule a match against a named opponent with date/time and venue.
4. Open **Live scoring**, select the match and press **START MATCH**.
5. Record `Point scored`, `Opponent point`, `Block`, `Turnover`, `Player on`, `Player off`, or `Other`; for our points select the scorer and optional assister. Each event stores its elapsed game time (MM:SS on screen).
6. Pause/resume the clock if needed. Press **END GAME** to publish a final score. Incorrect events can be deleted; database triggers automatically recalculate the score from the event log.
7. Guests see the live game and latest/pinned games on the homepage, can open `/games/{id}` for its timeline, and browse completed games through `/tournaments`. A game can be pinned by council/admin.

**Important:** One designated scorer at a time is advised; clock pause/resume from multiple devices is not yet lock-coordinated. Event inserts and score recalculation are handled atomically in Postgres, but this starter is not an official tournament federation scoring engine.

## 6 — Financial workflow

In **Club accounts**, create income (money held by a named council member), an expense (payment from a named holder), or a transfer (cash moving from one core holder to another). A transfer affects individual holdings but **does not change income, expense, or overall cash balance**. Each record has a reason and amount; choose club or player scope, and optionally attach a private receipt.

Financial receipts live in private bucket `finance-proofs`, visible only to council/admin through expiring signed URLs. Strategies similarly live in private `strategy-files`. Player photos and gallery uploads use public `club-media`.

Amounts default to **INR** in `src/lib.js` (`money()`), customizable to your club's preferred currency. This is a **cashbook**, not an audited double-entry accounting system with bank reconciliation, tax filings or accounting-period close locks. Do not treat it as a substitute for formal bookkeeping requirements.

## 7 — Deploy on Render

1. Push this project to a new GitHub repository (do **not** commit your `.env`).
2. In Render, choose **New → Static Site**, connect that repo. (Render can also read `render.yaml` as a Blueprint.)
3. Build command: `npm install && npm run build`.
4. Publish directory: `dist` (Render Blueprint uses `./dist`).
5. Set environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Add a **Rewrite** rule: source `/*`, destination `/index.html`, action **Rewrite**. This is already declared in `render.yaml`, but confirm it exists if you create the site manually.
7. Deploy, then update your Supabase Site URL and redirect URLs with the actual Render URL. Check sign-in, invite acceptance, media upload, scoreboard sync on two browser tabs, and finance access as player vs council.

No Render Web Service, private persistent disk, or custom backend is needed. Files, database triggers, email/password authentication, access policies and realtime are provided by Supabase.

## 8 — Relevant paths

- `/` public homepage
- `/squad`, `/council`, `/profile/:id` player and council pages
- `/about`, `/stories`, `/gallery`, `/contact`
- `/tournaments`, `/games/:id` tournament and match archives
- `/login` sign-in, `/join` invite-only activation
- `/dashboard` private dashboard; tabs: overview, profile, posts, strategies, whiteboard, tournaments, scoring, finances, members, messages

The login button **is visible** in the top-right header. When logged in, it becomes the member's avatar/dashboard link, per the later requirement.

## 9 — Important production notes

- Supabase RLS is the actual security boundary. Hiding a UI tab alone is **not** security. Test the policies after setup with at least one account per role.
- Email confirmation, strong passwords, official sender SMTP, bot/spam protections on the public Contact form, and Supabase rate limits should be reviewed before public launch. Anonymous Contact inserts can attract spam; add CAPTCHA/Edge Function validation if abuse occurs (this would be an optional further backend component).
- Bucket size/MIME limits are set by SQL (100 MB maximum per strategy video); free Supabase plans also have independent total storage/egress and other quotas. Whiteboard capture format depends on browser codec support. Mobile Safari may need still-image fallback.
- For the highest search-engine crawlability of **dynamic posts and individual player pages**, consider server-side prerendering later. This version is a fast SPA and includes basic meta tags, but does not provide server-rendered per-post SEO metadata.
- In this build, uploads do not automatically delete the original Storage object when a post/strategy/transaction is deleted; an admin can periodically clean orphaned objects from the Supabase Storage UI.
- Cash holding totals assume the ledger starts at zero; enter pre-existing cash as opening income. Reconcile with real balances before relying on totals.

## 10 — Project status / verification

All application source, SQL and deployment settings are included. JSX files have been checked for syntax with the TypeScript parser. **An actual `npm run build` and full Supabase integration test could not be completed in the generation environment because the npm registry was inaccessible.** After you run `npm install`, use `npm run build` locally and verify the full initial setup as above before production launch. This is a deployable application codebase, not an already live or independently audited service.
