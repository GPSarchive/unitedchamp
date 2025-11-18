// src/app/matches/[id]/MatchVideoAdminForm.tsx
import { updateMatchVideoAction } from "./actions";
import type { Id } from "@/app/lib/types";

export default function MatchVideoAdminForm({
  matchId,
  initialVideoUrl,
}: {
  matchId: Id;
  initialVideoUrl: string | null;
}) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Admin: Match Video</h2>
      <p className="mb-3 text-xs text-gray-500">
        Paste a full YouTube URL or just the video ID. Leave the field empty and save to remove
        the video from this match.
      </p>

      <form
        action={updateMatchVideoAction}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="match_id" value={String(matchId)} />

        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700">
            YouTube link or ID
          </label>
          <input
            type="text"
            name="video_url"
            defaultValue={initialVideoUrl ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
          />
          <p className="mt-1 text-[11px] text-gray-400">
            Stored in <code>matches.video_url</code>. Viewers see it in the “Match Video” section
            above.
          </p>
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700"
        >
          Save video
        </button>
      </form>
    </section>
  );
}
