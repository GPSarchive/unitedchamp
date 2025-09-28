"use client";

import * as React from "react";

type AnnouncementFull = {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  format: "md" | "html" | "plain";
  pinned: boolean;
  priority: number;
  status: "draft" | "scheduled" | "published" | "archived";
  start_at: string | null;
  end_at: string | null;
};

const pageSize = 50;

function toIsoOrNull(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function fromIsoToLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnnouncementsAdmin() {
  const [rows, setRows] = React.useState<AnnouncementFull[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [newItem, setNewItem] = React.useState<Partial<AnnouncementFull>>({
    title: "",
    body: "",
    format: "md",
    status: "draft",
    pinned: false,
    priority: 0,
    start_at: null,
    end_at: null,
  });

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements?offset=${nextOffset}&limit=${pageSize}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows((prev) => prev.concat(json.data ?? []));
      setNextOffset(json.nextOffset);
    } catch (e: any) {
      setError(e.message ?? "Αποτυχία φόρτωσης");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (rows.length === 0 && nextOffset === 0) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: newItem.title?.trim(),
        body: newItem.body ?? "",
        format: newItem.format ?? "md",
        status: newItem.status ?? "draft",
        pinned: !!newItem.pinned,
        priority: Number(newItem.priority ?? 0),
        start_at: toIsoOrNull(
          typeof newItem.start_at === "string" && newItem.start_at.includes("T")
            ? newItem.start_at
            : (newItem.start_at as any)
        ),
        end_at: toIsoOrNull(
          typeof newItem.end_at === "string" && newItem.end_at.includes("T")
            ? newItem.end_at
            : (newItem.end_at as any)
        ),
      };

      if (!payload.title) throw new Error("Απαιτείται τίτλος");

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Αποτυχία δημιουργίας");

      setRows((prev) => [json.data, ...prev]);
      setNewItem({
        title: "",
        body: "",
        format: "md",
        status: "draft",
        pinned: false,
        priority: 0,
        start_at: null,
        end_at: null,
      });
    } catch (e: any) {
      setError(e.message ?? "Αποτυχία δημιουργίας");
    } finally {
      setLoading(false);
    }
  }

  async function saveRow(id: number, patch: Partial<AnnouncementFull>) {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...patch,
        start_at: patch.start_at ? toIsoOrNull(patch.start_at as any) : patch.start_at ?? null,
        end_at: patch.end_at ? toIsoOrNull(patch.end_at as any) : patch.end_at ?? null,
      };
      const res = await fetch(`/api/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Αποτυχία ενημέρωσης");
      setRows((prev) => prev.map((r) => (r.id === id ? json.data : r)));
    } catch (e: any) {
      setError(e.message ?? "Αποτυχία ενημέρωσης");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("Διαγραφή αυτής της ανακοίνωσης;")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Αποτυχία διαγραφής");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message ?? "Αποτυχία διαγραφής");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-zinc-50">Διαχείριση ανακοινώσεων</h2>

      {/* Create form */}
      <form
        onSubmit={createAnnouncement}
        className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4 text-zinc-100"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Τίτλος">
            <input
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.title ?? ""}
              onChange={(e) => setNewItem((s) => ({ ...s, title: e.target.value }))}
              required
            />
          </Field>

          <Field label="Κατάσταση">
            <select
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.status ?? "draft"}
              onChange={(e) => setNewItem((s) => ({ ...s, status: e.target.value as any }))}
            >
              <option value="draft">Πρόχειρο</option>
              <option value="scheduled">Προγραμματισμένο</option>
              <option value="published">Δημοσιευμένο</option>
              <option value="archived">Αρχειοθετημένο</option>
            </select>
          </Field>

          <Field label="Μορφή">
            <select
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.format ?? "md"}
              onChange={(e) => setNewItem((s) => ({ ...s, format: e.target.value as any }))}
            >
              <option value="md">Markdown</option>
              <option value="html">HTML</option>
              <option value="plain">Απλό κείμενο</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 focus:ring-2 focus:ring-indigo-500"
              checked={!!newItem.pinned}
              onChange={(e) => setNewItem((s) => ({ ...s, pinned: e.target.checked }))}
            />
            Καρφιτσωμένο
          </label>

          <Field label="Προτεραιότητα">
            <input
              type="number"
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.priority ?? 0}
              onChange={(e) => setNewItem((s) => ({ ...s, priority: Number(e.target.value) }))}
            />
          </Field>

          <Field label="Έναρξη">
            <input
              type="datetime-local"
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.start_at ? (newItem.start_at as any) : ""}
              onChange={(e) => setNewItem((s) => ({ ...s, start_at: e.target.value }))}
            />
          </Field>

          <Field label="Λήξη">
            <input
              type="datetime-local"
              className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newItem.end_at ? (newItem.end_at as any) : ""}
              onChange={(e) => setNewItem((s) => ({ ...s, end_at: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Κείμενο">
          <textarea
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={newItem.body ?? ""}
            onChange={(e) => setNewItem((s) => ({ ...s, body: e.target.value }))}
          />
        </Field>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
          >
            {loading ? "Αποθήκευση…" : "Δημιουργία ανακοίνωσης"}
          </button>
          {error && <span className="text-sm text-rose-400 self-center">{error}</span>}
        </div>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-zinc-200">
            <thead className="bg-zinc-800/80 text-zinc-200">
              <tr className="text-left">
                <Th>Τίτλος</Th>
                <Th>Κατάσταση</Th>
                <Th>Καρφιτσ.</Th>
                <Th>Προτερ.</Th>
                <Th>Έναρξη</Th>
                <Th>Λήξη</Th>
                <Th>Ενέργειες</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <EditableRow key={r.id} row={r} onSave={saveRow} onDelete={deleteRow} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-zinc-800 flex items-center gap-3">
          {nextOffset !== null ? (
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            >
              {loading ? "Φόρτωση…" : "Φόρτωσε περισσότερα"}
            </button>
          ) : (
            <span className="text-xs text-zinc-400">Όλα φορτώθηκαν</span>
          )}
          {error && <span className="text-sm text-rose-400">{error}</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-200">{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}

function StatusPill({ s }: { s: AnnouncementFull["status"] }) {
  const map: Record<string, string> = {
    draft: "bg-zinc-800 text-zinc-200 ring-1 ring-inset ring-zinc-700",
    scheduled: "bg-sky-600/15 text-sky-300 ring-1 ring-inset ring-sky-600/30",
    published: "bg-emerald-600/15 text-emerald-300 ring-1 ring-inset ring-emerald-600/30",
    archived: "bg-amber-600/15 text-amber-300 ring-1 ring-inset ring-amber-600/30",
  };
  const labels: Record<AnnouncementFull["status"], string> = {
    draft: "Πρόχειρο",
    scheduled: "Προγραμματισμένο",
    published: "Δημοσιευμένο",
    archived: "Αρχειοθετημένο",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${map[s] || map.draft}`}>
      {labels[s]}
    </span>
  );
}

function IconPill({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
        on
          ? "bg-indigo-600/15 text-indigo-300 ring-indigo-600/30"
          : "bg-zinc-800 text-zinc-300 ring-zinc-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${on ? "bg-indigo-400" : "bg-zinc-500"}`}
        aria-hidden
      />
      {on ? "Ναι" : "Όχι"}
    </span>
  );
}

function ActionButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const { variant = "ghost", className = "", ...rest } = props;
  const base = "px-2 py-1 rounded-md text-sm focus:outline-none focus:ring-2";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-500 focus:ring-indigo-400"
      : variant === "danger"
      ? "border border-rose-600 text-rose-200 hover:bg-rose-600/10 focus:ring-rose-400"
      : "border border-zinc-700 text-zinc-100 hover:bg-zinc-800 focus:ring-indigo-400";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

function EditableRow({
  row,
  onSave,
  onDelete,
}: {
  row: AnnouncementFull;
  onSave: (id: number, patch: Partial<AnnouncementFull>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Partial<AnnouncementFull>>({ ...row });

  React.useEffect(() => {
    setDraft({ ...row });
  }, [row.id]);

  const save = async () => {
    const patch: Partial<AnnouncementFull> = {
      title: draft.title,
      body: draft.body,
      format: draft.format,
      status: draft.status,
      pinned: !!draft.pinned,
      priority: Number(draft.priority ?? 0),
      start_at:
        typeof draft.start_at === "string" && draft.start_at.includes("T")
          ? draft.start_at
          : fromIsoToLocal(draft.start_at as any),
      end_at:
        typeof draft.end_at === "string" && draft.end_at.includes("T")
          ? draft.end_at
          : fromIsoToLocal(draft.end_at as any),
    };
    await onSave(row.id, patch);
    setEditing(false);
  };

  return (
    <tr className="border-t border-zinc-800 align-top">
      <td className="px-3 py-2">
        {editing ? (
          <input
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={draft.title ?? ""}
            onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
          />
        ) : (
          <div className="font-medium text-zinc-100">{row.title}</div>
        )}
        <div className="text-xs text-zinc-400">
          Δημιουργήθηκε: {new Date(row.created_at).toLocaleString()}
        </div>
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <select
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={draft.status as any}
            onChange={(e) => setDraft((s) => ({ ...s, status: e.target.value as any }))}
          >
            <option value="draft">Πρόχειρο</option>
            <option value="scheduled">Προγραμματισμένο</option>
            <option value="published">Δημοσιευμένο</option>
            <option value="archived">Αρχειοθετημένο</option>
          </select>
        ) : (
          <StatusPill s={row.status} />
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 focus:ring-2 focus:ring-indigo-500"
              checked={!!draft.pinned}
              onChange={(e) => setDraft((s) => ({ ...s, pinned: e.target.checked }))}
            />
            <span className="text-sm text-zinc-200">Καρφιτσωμένο</span>
          </label>
        ) : (
          <IconPill on={row.pinned} />
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="number"
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded px-2 py-1 w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={Number(draft.priority ?? 0)}
            onChange={(e) => setDraft((s) => ({ ...s, priority: Number(e.target.value) }))}
          />
        ) : (
          <span className="text-zinc-100">{row.priority}</span>
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="datetime-local"
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={
              typeof draft.start_at === "string" && draft.start_at.includes("T")
                ? (draft.start_at as string)
                : fromIsoToLocal(draft.start_at as any)
            }
            onChange={(e) => setDraft((s) => ({ ...s, start_at: e.target.value }))}
          />
        ) : (
          <span className="text-xs text-zinc-300">
            {row.start_at ? new Date(row.start_at).toLocaleString() : "—"}
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="datetime-local"
            className="border border-zinc-700 bg-zinc-900 text-zinc-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={
              typeof draft.end_at === "string" && draft.end_at.includes("T")
                ? (draft.end_at as string)
                : fromIsoToLocal(draft.end_at as any)
            }
            onChange={(e) => setDraft((s) => ({ ...s, end_at: e.target.value }))}
          />
        ) : (
          <span className="text-xs text-zinc-300">
            {row.end_at ? new Date(row.end_at).toLocaleString() : "—"}
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="flex gap-2">
          {!editing ? (
            <>
              <ActionButton onClick={() => setEditing(true)} variant="ghost">Επεξεργασία</ActionButton>
              <ActionButton onClick={() => onDelete(row.id)} variant="danger">Διαγραφή</ActionButton>
            </>
          ) : (
            <>
              <ActionButton onClick={save} variant="primary">Αποθήκευση</ActionButton>
              <ActionButton onClick={() => setEditing(false)} variant="ghost">Άκυρο</ActionButton>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
