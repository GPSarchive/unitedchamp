// components/tournaments/TournamentsGrid.tsx
import TournamentCard, { TournamentCardData } from "./TournamentCard";

export default function TournamentsGrid({
  items,
  showStatus = false,
}: {
  items: TournamentCardData[];
  showStatus?: boolean;
}) {
  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {(items ?? []).map((t) => (
        <TournamentCard key={t.id} t={t} showStatus={showStatus} />
      ))}
      {(!items || items.length === 0) && (
        <div className="text-white/60">Δεν βρέθηκαν τουρνουά.</div>
      )}
    </div>
  );
}
