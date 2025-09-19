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

const pageSize = 50; // load in chunks if you have lots

function toIsoOrNull(v: string | null | undefined) {
  if (!v) return null;
  // v is "YYYY-MM-DDTHH:mm" from <input type="datetime-local">
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function fromIsoToLocal(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  // Convert to "YYYY-MM-DDTHH:mm" for <input datetime-local>
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnnouncementsAdmin() {
  const [rows, setRows] = React.useState<AnnouncementFull[]>([]);
  const [nextOffset, setNextOffset] = React.useState<number | null>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create form state
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
      // active=0 (omit it) to load ALL (requires admin SELECT policy)
      const res = await fetch(`/api/announcements?offset=${nextOffset}&limit=${pageSize}`, { cache: "no-store" });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRows((prev) => prev.concat(json.data ?? []));
      setNextOffset(json.nextOffset);
    } catch (e: any) {
      setError(e.message ?? "Failed to load");
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

      if (!payload.title) throw new Error("Title is required");

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");

      // Put new item on top
      setRows((prev) => [json.data, ...prev]);
      // Reset form
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
      setError(e.message ?? "Create failed");
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
      if (!res.ok) throw new Error(json.error || "Update failed");

      setRows((prev) => prev.map((r) => (r.id === id ? json.data : r)));
    } catch (e: any) {
      setError(e.message ?? "Update failed");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRow(id: number) {
    if (!confirm("Delete this announcement?")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      setError(e.message ?? "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Announcements (Admin)</h2>

      {/* Create form */}
      <form onSubmit={createAnnouncement} className="rounded-xl border bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Title</span>
            <input
              className="border rounded-lg px-3 py-2"
              value={newItem.title ?? ""}
              onChange={(e) => setNewItem((s) => ({ ...s, title: e.target.value }))}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Status</span>
            <select
              className="border rounded-lg px-3 py-2"
              value={newItem.status ?? "draft"}
              onChange={(e) => setNewItem((s) => ({ ...s, status: e.target.value as any }))}
            >
              <option value="draft">draft</option>
              <option value="scheduled">scheduled</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Format</span>
            <select
              className="border rounded-lg px-3 py-2"
              value={newItem.format ?? "md"}
              onChange={(e) => setNewItem((s) => ({ ...s, format: e.target.value as any }))}
            >
              <option value="md">md</option>
              <option value="html">html</option>
              <option value="plain">plain</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!newItem.pinned}
              onChange={(e) => setNewItem((s) => ({ ...s, pinned: e.target.checked }))}
            />
            <span className="text-sm font-medium">Pinned</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Priority</span>
            <input
              type="number"
              className="border rounded-lg px-3 py-2"
              value={newItem.priority ?? 0}
              onChange={(e) => setNewItem((s) => ({ ...s, priority: Number(e.target.value) }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Start at</span>
            <input
              type="datetime-local"
              className="border rounded-lg px-3 py-2"
              value={newItem.start_at ? (newItem.start_at as any) : ""}
              onChange={(e) => setNewItem((s) => ({ ...s, start_at: e.target.value }))}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">End at</span>
            <input
              type="datetime-local"
              className="border rounded-lg px-3 py-2"
              value={newItem.end_at ? (newItem.end_at as any) : ""}
              onChange={(e) => setNewItem((s) => ({ ...s, end_at: e.target.value }))}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Body</span>
          <textarea
            className="border rounded-lg px-3 py-2 min-h-[120px]"
            value={newItem.body ?? ""}
            onChange={(e) => setNewItem((s) => ({ ...s, body: e.target.value }))}
          />
        </label>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
          >
            {loading ? "Saving…" : "Create announcement"}
          </button>
          {error && <span className="text-sm text-red-600 self-center">{error}</span>}
        </div>
      </form>

      {/* Table */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Pinned</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Start</th>
                <th className="px-3 py-2">End</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <EditableRow key={r.id} row={r} onSave={saveRow} onDelete={deleteRow} />
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t flex items-center gap-3">
          {nextOffset !== null ? (
            <button onClick={loadMore} disabled={loading} className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50">
              {loading ? "Loading…" : "Load more"}
            </button>
          ) : (
            <span className="text-xs text-gray-500">All loaded</span>
          )}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ s }: { s: AnnouncementFull["status"] }) {
  const map: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    scheduled: "bg-blue-100 text-blue-700",
    published: "bg-emerald-100 text-emerald-700",
    archived: "bg-amber-100 text-amber-800",
  };
  return <span className={`px-2 py-0.5 rounded text-xs ${map[s] || "bg-gray-100 text-gray-700"}`}>{s}</span>;
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
  }, [row.id]); // reset when list refreshes or when switching rows

  const save = async () => {
    const patch: Partial<AnnouncementFull> = {
      title: draft.title,
      body: draft.body,
      format: draft.format,
      status: draft.status,
      pinned: !!draft.pinned,
      priority: Number(draft.priority ?? 0),
      start_at: typeof draft.start_at === "string" && draft.start_at.includes("T")
        ? draft.start_at
        : fromIsoToLocal(draft.start_at as any),
      end_at: typeof draft.end_at === "string" && draft.end_at.includes("T")
        ? draft.end_at
        : fromIsoToLocal(draft.end_at as any),
    };
    await onSave(row.id, patch);
    setEditing(false);
  };

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2">
        {editing ? (
          <input
            className="border rounded px-2 py-1 w-full"
            value={draft.title ?? ""}
            onChange={(e) => setDraft((s) => ({ ...s, title: e.target.value }))}
          />
        ) : (
          <div className="font-medium">{row.title}</div>
        )}
        <div className="text-xs text-gray-500">
          Created: {new Date(row.created_at).toLocaleString()}
        </div>
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <select
            className="border rounded px-2 py-1"
            value={draft.status as any}
            onChange={(e) => setDraft((s) => ({ ...s, status: e.target.value as any }))}
          >
            <option value="draft">draft</option>
            <option value="scheduled">scheduled</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        ) : (
          <StatusPill s={row.status} />
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="checkbox"
            checked={!!draft.pinned}
            onChange={(e) => setDraft((s) => ({ ...s, pinned: e.target.checked }))}
          />
        ) : (
          <span className="text-xs">{row.pinned ? "Yes" : "No"}</span>
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="number"
            className="border rounded px-2 py-1 w-20"
            value={Number(draft.priority ?? 0)}
            onChange={(e) => setDraft((s) => ({ ...s, priority: Number(e.target.value) }))}
          />
        ) : (
          <span>{row.priority}</span>
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="datetime-local"
            className="border rounded px-2 py-1"
            value={
              typeof draft.start_at === "string" && draft.start_at.includes("T")
                ? (draft.start_at as string)
                : fromIsoToLocal(draft.start_at as any)
            }
            onChange={(e) => setDraft((s) => ({ ...s, start_at: e.target.value }))}
          />
        ) : (
          <span className="text-xs">
            {row.start_at ? new Date(row.start_at).toLocaleString() : "—"}
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        {editing ? (
          <input
            type="datetime-local"
            className="border rounded px-2 py-1"
            value={
              typeof draft.end_at === "string" && draft.end_at.includes("T")
                ? (draft.end_at as string)
                : fromIsoToLocal(draft.end_at as any)
            }
            onChange={(e) => setDraft((s) => ({ ...s, end_at: e.target.value }))}
          />
        ) : (
          <span className="text-xs">
            {row.end_at ? new Date(row.end_at).toLocaleString() : "—"}
          </span>
        )}
      </td>

      <td className="px-3 py-2">
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => onDelete(row.id)}>
                Delete
              </button>
            </>
          ) : (
            <>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={save}>
                Save
              </button>
              <button className="px-2 py-1 rounded border hover:bg-gray-50" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
