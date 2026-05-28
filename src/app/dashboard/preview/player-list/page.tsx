// src/app/dashboard/preview/player-list/page.tsx
import AdminPlayersListView from "./AdminPlayersListView";

export const dynamic = "force-dynamic";

export default function PlayerListPreviewPage() {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Παίκτες (Preview · List View)</h2>
          <p className="mt-1 text-xs text-white/50">
            /paiktes-style list with filters · admin actions preserved · row click opens editor.
          </p>
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-0 overflow-hidden">
        <AdminPlayersListView />
      </div>
    </div>
  );
}
