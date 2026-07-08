"use client";

// Catalog fetch copied from teams/TeamPicker.tsx (same /api/teams?sign=1 call
// and liberal shape coercion) so the redesigned picker behaves identically.

import { useCallback, useEffect, useMemo, useState } from "react";

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

export type CatalogRow = {
  id: number;
  name: string;
  logo?: string | null;
  deleted_at?: string | null;
};

export function useTeamCatalog(showArchived: boolean) {
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sign: "1" });
      if (showArchived) params.set("include", "all");
      const res = await fetch(`/api/teams?${params.toString()}`, {
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const arr: Array<any> = body?.teams ?? body?.data ?? body ?? [];
      const rows: CatalogRow[] = arr
        .map((t: any) => ({
          id: Number(t.id),
          name: String(t.name ?? t.team_name ?? t.title ?? `Team #${t.id}`),
          logo: t.logo ?? null,
          deleted_at: t.deleted_at ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setCatalog(rows);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setCatalog([]);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => {
    const m = new Map<number, CatalogRow>();
    for (const t of catalog) m.set(t.id, t);
    return m;
  }, [catalog]);

  return { catalog, byId, loading, error, reload: load };
}
