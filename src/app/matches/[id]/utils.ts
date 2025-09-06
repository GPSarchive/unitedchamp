//matches/[id]/utils.ts
import type { MatchStatus } from "@/app/lib/types";

export function parseId(s: string | undefined | null) {
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? (n as any) : null;
}

/** Accepts a YouTube id or full URL and returns the video id */
export function extractYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (/^[a-zA-Z0-9_-]{11}$/.test(last)) return last;
  } catch {}
  return null;
}

export function formatStatus(status: MatchStatus) {
  switch (status) {
    case "scheduled": return "Scheduled";
    case "live": return "Live";
    case "finished": return "Final";
    case "canceled": return "Canceled";
  }
}
