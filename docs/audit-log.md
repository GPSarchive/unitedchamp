# Audit log — who changed what, when, from where

Built 2026-09-14 on `feat/audit-log`. Answers two questions for the admin team:
*"who did this?"* (petty meddling) and *"what did the row look like before?"* (human
mistakes). Companion: [roles-and-permissions.md](roles-and-permissions.md).

## Two layers, one table

Everything lands in `public.audit_log` (created by
[migrations/add-audit-log.sql](../migrations/add-audit-log.sql)).

| `source` | Written by | What one row means |
|---|---|---|
| `db` | Postgres triggers, in the same transaction as the write | One INSERT / UPDATE / DELETE on one row of a source-of-truth table, with `old_row`, `new_row` and — for updates — `changed` (`{ column: { from, to } }`). Captured **whatever the code path**: API route, server action, service-role engine, SQL editor, Supabase Studio, a script with the service key. |
| `app` | `logAdminAction()` in [src/app/lib/audit/log.ts](../src/app/lib/audit/log.ts) | One admin **action** that a single row cannot express: closed a season, saved a whole tournament, deleted a storage object, granted a role, rebuilt the stat caches. |

Rows of both kinds carry `request_id` and `route`, so one click in the dashboard
("save tournament") shows up as one `app` row plus every `db` row it caused, all
sharing the same request id. The viewer has a link for exactly that.

### Audited tables (`source = 'db'`)

`matches`, `match_player_stats`, `match_participants`, `tournament_awards`,
`disciplinary_actions`, `tournaments`, `tournament_stages`, `tournament_groups`,
`tournament_teams`, `stage_slots`, `intake_mappings`, `teams`, `player`,
`player_teams`, `articles`, `announcements`, `seasons`, `season_team_adjustments`,
plus `auth.users` (role / email / ban changes, account creation and deletion).

**Not audited on purpose** — derived caches that are rebuilt wholesale from the
tables above and would flood the log: `stage_standings`, `player_tournament_stats`,
`player_season_stats`, `player_statistics`, `season_team_standings`,
`season_recaps`, `team_season_score_archive`. The *actions* that rebuild them are
logged as `app` rows (`stats.rebuild_all`, `season.resnapshot`, …).

An UPDATE whose only differences are ignored columns (`updated_at` everywhere,
`view_count` on articles) is **not logged at all** — public page views bump
`view_count` and would otherwise drown the history.

### App events (`source = 'app'`), by `op`

| `op` | Where |
|---|---|
| `role.grant` / `role.revoke` | `POST /api/admin/users/[id]/roles` — before/after role arrays in `meta` |
| `tournament.save_all` | `POST /api/tournaments/[id]/save-all` — counts of everything the save touched |
| `stage.reseed` | `POST /api/stages/[id]/reseed` |
| `season.close` / `season.set_active` / `season.resnapshot` / `season.refresh_active` | `dashboard/seasons/actions.ts` |
| `stats.rebuild_all` / `stats.apply_sync_fix` | `dashboard/refresh-stats`, `dashboard/fix-stats` |
| `storage.upload` / `storage.delete` / `storage.replace` | the storage + logo routes (storage objects have no row trigger) |

## How the actor is known

```
browser ──► proxy.ts (edge)
              strips any client-sent x-audit-* header
              stamps  x-audit-request  (uuid)      x-audit-route ("POST /api/…")
              resolves the session and stamps
                      x-audit-actor    (user id)   x-audit-actor-email
                ──► Node route handler / server action
                      supabaseAdmin (service role) ── lib/audit/fetch.ts copies the
                      x-audit-* headers onto every MUTATING PostgREST call ──► PostgREST
                      cookie-bound client ── carries the user's own JWT ──────────► PostgREST
                                                                                       │
                                                             audit_row_change() trigger reads
                                                             request.jwt.claims + request.headers
```

Trust rules inside the trigger (`public.audit_request_context()`):

* JWT role `authenticated` (cookie-bound client): actor = `auth.uid()` from the JWT.
  Headers are ignored — a user cannot claim to be someone else.
* JWT role `service_role` (our server): actor = the `x-audit-actor` headers. Only our
  server holds the service key, so only our server can assert an actor; the proxy
  deletes any such header a client sends before stamping its own.
* No JWT (SQL editor, Supabase Studio, GoTrue): actor NULL, `db_role` =
  `postgres` / `supabase_auth_admin`. **This is the "someone edited the data
  outside the app" signal** — the viewer's "Χωρίς χρήστη" quick filter lists exactly
  these rows.

`lib/audit/fetch.ts` looks at request headers **only for mutations** (table
writes and the RPCs listed in `AUDIT_WRITE_RPCS`). Reads never touch
`headers()`, so ISR-cached pages stay static. Add a new writing RPC to that list
when you create one, or its rows will be recorded without an actor.

## Reading it

Dashboard → **Ιστορικό ενεργειών** (`/dashboard/audit`, admins only). Filters:
user (email), table, action, source, record id, date range; every row expands
to the full before/after JSON; the table/record link opens that record's whole
history; "όλες οι αλλαγές του ίδιου αιτήματος" groups by request.

Useful SQL (Supabase SQL editor):

```sql
-- History of one match
SELECT at, op, actor_email, db_role, route, changed
FROM public.audit_log WHERE table_name = 'matches' AND record_id = '2566' ORDER BY id;

-- Everything done outside the app (SQL editor / Studio / scripts) this month
SELECT at, op, table_name, record_id, db_role, changed
FROM public.audit_log WHERE actor_id IS NULL AND source = 'db' AND at > date_trunc('month', now()) ORDER BY id DESC;

-- What one admin did today
SELECT at, source, op, table_name, record_id, summary
FROM public.audit_log WHERE actor_email = 'someone@example.com' AND at::date = current_date ORDER BY id;

-- Restore a deleted row's values (old_row is the full row as it was)
SELECT old_row FROM public.audit_log WHERE table_name = 'teams' AND op = 'DELETE' AND record_id = '42';
```

Supabase also keeps its own **auth** audit (`auth.audit_log_entries`: logins,
token refreshes, sign-ups) — section 9 of
[scripts/investigate-roles.sql](../scripts/investigate-roles.sql) shows it.

## Deploying

1. Run `migrations/add-audit-log.sql` in the Supabase SQL editor (idempotent).
   It also drops the dead, empty legacy `audit_logs` table — in its own
   transaction, refusing if that table unexpectedly has rows. Run
   `migrations/add-admin-role-guards.sql` as well: it makes Postgres refuse to
   demote or delete the last admin, whoever asks (see
   [roles-and-permissions.md](roles-and-permissions.md) §1).
2. Deploy the code on `feat/audit-log` (proxy headers, fetch wrapper, app events,
   viewer). Without the migration the app still works: `logAdminAction` never throws
   and the viewer shows a hint instead of crashing.
3. Run the VERIFY block at the bottom of the migration, then save any match from
   the dashboard and open `/dashboard/audit` — the row should carry your email and
   the API route.

## Retention and tamper resistance

* Append-only: `UPDATE`/`DELETE`/`TRUNCATE` are revoked from the app roles
  (including the service role) and a guard trigger refuses row mutations even for
  the owner. To prune deliberately, in the SQL editor:

  ```sql
  SET audit.allow_prune = 'on';
  DELETE FROM public.audit_log WHERE at < now() - interval '2 years';
  ```
* Only admins can read it (RLS on `authenticated`; anon has no grant).
* Volume: one row per row written. A full tournament save of ~150 matches produces
  ~150 rows; article edits store the whole content JSON twice. Expect tens of
  thousands of rows per season, not millions. Indexes cover time, record, actor
  and request lookups.

## Failure behaviour

* Public-table triggers **fail closed**: if the audit insert fails, the write fails.
  The log can never silently miss a data change.
* The `auth.users` trigger **fails open** (logs a warning): it fires on every login
  (`last_sign_in_at`), so an audit hiccup must never block authentication.
* `logAdminAction` never throws; a failure goes to the server log only. The `db`
  rows remain the reliable record.
* Attribution is best-effort by design: a row with `db_role = service_role` and
  no actor means a service-role write that carried no headers — a script, a code
  path outside a request, or a write RPC missing from `AUDIT_WRITE_RPCS`.

## Extending

* **New table**: add one line to the `VALUES` list in §5 of the migration and
  re-run it (safe), plus a Greek label in `TABLE_LABELS`
  ([format.ts](../src/app/lib/audit/format.ts)).
* **New app event**: call `logAdminAction({ action, table, recordId, summary, meta, actor })`
  after the write succeeds. Pass `actor` when the handler has the user (it always
  does after its auth check).
* **New service-role client**: use the shared `supabaseAdmin` — a locally created
  `createClient(url, SERVICE_ROLE_KEY)` writes without attribution (the storage
  routes still do this; they only touch storage objects, which have no trigger).

## What it does not cover

* Storage object contents (only the upload/delete/replace *events*).
* Reads. Nobody is logged for looking.
* Changes made with the Supabase dashboard's own login — they ARE captured as
  `db_role = postgres`, but the Supabase account that made them is not visible to
  Postgres. Keep that login with the owner only.
