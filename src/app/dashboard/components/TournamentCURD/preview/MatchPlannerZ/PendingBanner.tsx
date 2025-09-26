

// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/PendingBanner.tsx
// ===============================
"use client";

export default function PendingBanner({ count, onSaveAll }: { count: number; onSaveAll: () => void }) {
  if (count <= 0) return null;
  return (
    <div className="rounded-md border border-amber-400/30 bg-amber-500/10 p-2 text-amber-200 text-xs flex items-center justify-between">
      <span>
        Υπάρχουν {count} εκκρεμείς αλλαγές σε εμφανιζόμενους αγώνες. Οι εκκρεμείς αλλαγές ΔΕΝ αποθηκεύονται αν
        πατήσετε «Save changes» στο τέλος.
      </span>
      <div className="flex items-center gap-2">
        <button className="px-2 py-1 rounded border border-amber-400/50 hover:bg-amber-500/10" onClick={onSaveAll}>
          Αποθήκευση όλων
        </button>
      </div>
    </div>
  );
}