"use client";

// Private referee note for this match, saved with "Save all" by
// saveAllStatsAction. Rendered for admins only (the table's RLS is admin-only
// too); all notes are listed on /dashboard/match-notes.
import * as React from "react";
import Link from "next/link";

const MAX = 2000;

export default function RefereeNoteField({
  initialNote,
  initialRefereeName,
}: {
  initialNote: string;
  /** Stored name, or the logged-in admin's email when none is stored yet. */
  initialRefereeName: string;
}) {
  const [note, setNote] = React.useState(initialNote);

  return (
    <div className="mt-4 rounded-lg border border-white/15 bg-black/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="referee_note" className="text-sm font-semibold text-white">
          Σημειώσεις διαιτητή
        </label>
        <Link
          href="/dashboard/match-notes"
          className="text-xs text-white/60 underline-offset-2 hover:text-white hover:underline"
        >
          Όλες οι σημειώσεις →
        </Link>
      </div>
      <p className="mt-1 text-xs text-white/60">
        Ιδιωτικό — το βλέπουν μόνο οι διαχειριστές. Άδειο πεδίο διαγράφει τη σημείωση.
      </p>
      <label htmlFor="referee_note_name" className="mt-3 block text-xs font-medium text-white/70">
        Διαιτητής
      </label>
      <input
        id="referee_note_name"
        name="referee_note_name"
        type="text"
        defaultValue={initialRefereeName}
        maxLength={120}
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
      <textarea
        id="referee_note"
        name="referee_note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={MAX}
        rows={3}
        placeholder="π.χ. αναφορά για συμπεριφορά, καθυστέρηση έναρξης, τραυματισμός…"
        className="mt-2 w-full resize-y rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
      />
      <div className="mt-1 text-right text-[11px] text-white/40">
        {note.length}/{MAX}
      </div>
    </div>
  );
}
