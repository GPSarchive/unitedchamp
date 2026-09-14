// src/app/dashboard/audit/page.tsx
// SERVER: the admin audit trail (Ιστορικό ενεργειών) — who changed what, when,
// through which route. Reads public.audit_log (migrations/add-audit-log.sql);
// see docs/audit-log.md for how rows get there.
//
// Auth: proxy.ts + dashboard/layout.tsx admit only admins to this path (it is
// not in the editor allow-list). The table's own RLS also limits direct reads
// to admins, so the service-role read here is a convenience, not a bypass.
import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { formatInstant } from "@/app/lib/datetime";
import {
  actorLabel,
  opLabel,
  summarizeAuditRow,
  tableLabel,
  TABLE_LABELS,
  type AuditLogRow,
} from "@/app/lib/audit/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SP = {
  actor?: string;
  who?: string;
  table?: string;
  op?: string;
  source?: string;
  record?: string;
  request?: string;
  from?: string;
  to?: string;
  page?: string;
};

type Filters = {
  actor: string;
  who: string;
  table: string;
  op: string;
  source: string;
  record: string;
  request: string;
  from: string;
  to: string;
};

const clean = (v: string | undefined, max = 200) => (v ?? "").trim().slice(0, max);
const isIsoDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

function badgeClass(row: AuditLogRow): string {
  if (row.source === "app") return "bg-sky-500/15 text-sky-200 ring-sky-400/30";
  switch (row.op) {
    case "INSERT":
      return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30";
    case "DELETE":
      return "bg-rose-500/15 text-rose-200 ring-rose-400/30";
    default:
      return "bg-amber-500/15 text-amber-200 ring-amber-400/30";
  }
}

export default async function AuditPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};
  const f: Filters = {
    actor: clean(sp.actor),
    who: clean(sp.who),
    table: clean(sp.table),
    op: clean(sp.op),
    source: clean(sp.source),
    record: clean(sp.record),
    request: clean(sp.request),
    from: isIsoDay(clean(sp.from)) ? clean(sp.from) : "",
    to: isIsoDay(clean(sp.to)) ? clean(sp.to) : "",
  };
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  let q = supabaseAdmin
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("id", { ascending: false });

  if (f.actor) q = q.ilike("actor_email", `%${f.actor.replace(/[%_,()]/g, "")}%`);
  // "unattributed": writes with no admin behind them — the SQL editor,
  // Supabase Studio, GoTrue, or a script holding the service key.
  if (f.who === "unattributed") q = q.is("actor_id", null);
  if (f.table) q = q.eq("table_name", f.table);
  if (f.op) q = q.eq("op", f.op);
  if (f.source === "db" || f.source === "app") q = q.eq("source", f.source);
  if (f.record) q = q.eq("record_id", f.record);
  if (f.request) q = q.eq("request_id", f.request);
  // Calendar days of the league (Europe/Athens, +02:00/+03:00). Being an hour
  // off at the boundary is acceptable for a history filter.
  if (f.from) q = q.gte("at", `${f.from}T00:00:00+02:00`);
  if (f.to) q = q.lte("at", `${f.to}T23:59:59+03:00`);

  const start = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await q.range(start, start + PAGE_SIZE - 1);
  const rows = (data ?? []) as AuditLogRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Link to this page with some filters overridden (page resets unless given). */
  const link = (over: Partial<Filters & { page: number }>) => {
    const merged: Record<string, string | number> = { ...f, page: 1, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v === "" || v === undefined || (k === "page" && v === 1)) continue;
      p.set(k, String(v));
    }
    const qs = p.toString();
    return qs ? `/dashboard/audit?${qs}` : "/dashboard/audit";
  };

  const activeFilters = Object.entries(f).filter(([, v]) => v !== "");

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-white">Ιστορικό ενεργειών</h2>
        <p className="text-sm text-white/60">
          Κάθε δημιουργία, αλλαγή και διαγραφή στα δεδομένα, με τον χρήστη που την έκανε. Οι
          αλλαγές χωρίς χρήστη έγιναν εκτός εφαρμογής (SQL editor, Supabase Studio, script).
        </p>
      </header>

      {/* Filters */}
      <form method="get" className="rounded-2xl border border-white/10 bg-black/40 p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Χρήστης (email)
          <input name="actor" defaultValue={f.actor} placeholder="π.χ. giorgos@"
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15 placeholder:text-white/40" />
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Πίνακας
          <select name="table" defaultValue={f.table}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15">
            <option value="">Όλοι</option>
            {Object.entries(TABLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v} ({k})</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Ενέργεια
          <select name="op" defaultValue={f.op}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15">
            <option value="">Όλες</option>
            <option value="INSERT">Δημιουργία</option>
            <option value="UPDATE">Αλλαγή</option>
            <option value="DELETE">Διαγραφή</option>
          </select>
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Πηγή
          <select name="source" defaultValue={f.source}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15">
            <option value="">Όλες</option>
            <option value="db">Αλλαγές γραμμών (db)</option>
            <option value="app">Ενέργειες εφαρμογής (app)</option>
          </select>
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Εγγραφή (id)
          <input name="record" defaultValue={f.record} placeholder="π.χ. 2566"
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15 placeholder:text-white/40" />
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Από
          <input type="date" name="from" defaultValue={f.from}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15" />
        </label>
        <label className="text-xs text-white/60 flex flex-col gap-1">
          Έως
          <input type="date" name="to" defaultValue={f.to}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15" />
        </label>
        <div className="flex items-end gap-2">
          {f.request ? <input type="hidden" name="request" value={f.request} /> : null}
          {f.who ? <input type="hidden" name="who" value={f.who} /> : null}
          <button type="submit"
            className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800">
            Φίλτρο
          </button>
          <Link href="/dashboard/audit"
            className="px-3 py-2 rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5">
            Καθαρισμός
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-white/50">Γρήγορα:</span>
        <Link href={link({ who: "unattributed" })}
          className="px-2 py-1 rounded-md border border-rose-400/30 text-rose-200 bg-rose-500/10 hover:bg-rose-500/20">
          Χωρίς χρήστη (εκτός εφαρμογής)
        </Link>
        <Link href={link({ op: "DELETE" })}
          className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:bg-white/5">
          Μόνο διαγραφές
        </Link>
        <Link href={link({ table: "auth.users" })}
          className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:bg-white/5">
          Ρόλοι & λογαριασμοί
        </Link>
        <Link href={link({ source: "app" })}
          className="px-2 py-1 rounded-md border border-white/15 text-white/80 hover:bg-white/5">
          Ενέργειες εφαρμογής
        </Link>
        {activeFilters.length > 0 ? (
          <span className="text-white/40">
            · ενεργά φίλτρα: {activeFilters.map(([k, v]) => `${k}=${v}`).join(", ")}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          <p className="font-semibold">Δεν ήταν δυνατή η ανάγνωση του ιστορικού.</p>
          <p className="mt-1 text-rose-200/80">{error.message}</p>
          <p className="mt-2 text-rose-200/70">
            Αν ο πίνακας <code>audit_log</code> δεν υπάρχει ακόμα, τρέξε το{" "}
            <code>migrations/add-audit-log.sql</code> στο Supabase SQL editor.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/40">
          <div className="flex items-center justify-between px-3 py-2 text-xs text-white/50 border-b border-white/10">
            <span>{total} εγγραφές</span>
            <span>σελίδα {page} / {pages}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="px-3 py-2">Πότε</th>
                  <th className="px-3 py-2">Ποιος</th>
                  <th className="px-3 py-2">Ενέργεια</th>
                  <th className="px-3 py-2">Πίνακας / εγγραφή</th>
                  <th className="px-3 py-2">Τι άλλαξε</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-white/50">
                      Καμία εγγραφή για αυτά τα φίλτρα.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t border-white/10 align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-white/80">
                        {formatInstant(r.at, { dateStyle: "short", timeStyle: "medium" })}
                      </td>
                      <td className="px-3 py-2">
                        {r.actor_email ? (
                          <Link href={link({ actor: r.actor_email })} className="text-emerald-200 hover:underline">
                            {r.actor_email}
                          </Link>
                        ) : (
                          <span className={r.actor_id ? "text-white/80" : "text-rose-200"}>{actorLabel(r)}</span>
                        )}
                        {r.actor_id && r.db_role && r.db_role !== "service_role" ? (
                          <span className="block text-xs text-white/40">{r.db_role}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-block rounded-md px-2 py-0.5 text-xs ring-1 ${badgeClass(r)}`}>
                          {r.source === "db" ? opLabel(r.op) : r.op}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.table_name ? (
                          <Link
                            href={link({ table: r.table_name, record: r.record_id ?? "" })}
                            className="text-white/90 hover:underline"
                            title="Ιστορικό αυτής της εγγραφής"
                          >
                            {tableLabel(r.table_name)}
                            {r.record_id ? <span className="text-white/50"> #{r.record_id}</span> : null}
                          </Link>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-white/80">
                        <div className="break-words">{summarizeAuditRow(r) || <span className="text-white/40">—</span>}</div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-white/50 hover:text-white/80">
                            λεπτομέρειες{r.route ? ` · ${r.route}` : ""}
                          </summary>
                          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-white/70 whitespace-pre-wrap break-all">
{JSON.stringify(
  {
    route: r.route,
    request_id: r.request_id,
    db_role: r.db_role,
    actor_id: r.actor_id,
    changed: r.changed,
    old_row: r.old_row,
    new_row: r.new_row,
    meta: r.meta,
  },
  null,
  2,
)}
                          </pre>
                          {r.request_id ? (
                            <Link href={link({ request: r.request_id })} className="text-xs text-sky-200 hover:underline">
                              όλες οι αλλαγές του ίδιου αιτήματος
                            </Link>
                          ) : null}
                        </details>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 py-2 text-sm border-t border-white/10">
            {page > 1 ? (
              <Link href={link({ page: page - 1 })} className="text-white/80 hover:text-white">← Προηγούμενη</Link>
            ) : <span />}
            {page < pages ? (
              <Link href={link({ page: page + 1 })} className="text-white/80 hover:text-white">Επόμενη →</Link>
            ) : <span />}
          </div>
        </div>
      )}
    </div>
  );
}
