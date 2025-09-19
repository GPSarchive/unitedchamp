//components/DashboardPageComponents/teams/teamHelpers.ts
// Shared helpers for Admin Teams UI

export async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

export function isUrl(v: string) {
  return /^https?:\/\//i.test(v);
}

// Accepts paths like "slug/file.png" OR "teams/123/logo.png"
// - no leading "/"
// - no ".."
// - at least one "/"
// - ends with file.ext
export function isStoragePath(v: string) {
  return /^(?!\/)(?!.*\.\.)(?:[^/]+\/)+[^/]+\.[a-z0-9]+$/i.test(v);
}

export async function signIfNeeded(logo: string | null): Promise<string | null> {
  if (!logo) return null;
  if (isUrl(logo)) return logo;
  if (!isStoragePath(logo)) return null;

  // Map private storage path → stable proxy URL (no network call needed)
  const encoded = logo.split("/").map(encodeURIComponent).join("/");
  return `/api/public/team-logo/${encoded}`;
}

export function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
