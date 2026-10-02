// src/app/lib/dashboardAccess.ts
// Which dashboard sections an editor-only account may open. One list, used by
// the proxy (page access), the sidebar (what to show) and the dashboard home
// (which cards to list), so the three can never disagree.

/** Section prefixes an editor may open; everything else under /dashboard is admin-only. */
export const EDITOR_DASHBOARD_SECTIONS = [
  "/dashboard/articles",
  "/dashboard/announcements",
  "/dashboard/players",
  "/dashboard/teams",
] as const;

/** True when an editor-only account may load this dashboard path. */
export function editorMayOpen(path: string): boolean {
  if (path === "/dashboard") return true;
  return EDITOR_DASHBOARD_SECTIONS.some(
    (p) => path === p || path.startsWith(p + "/")
  );
}
