//app/dashboard/tournaments/TournamentCURD/shared/ValidationSummary.tsx
"use client";

export default function ValidationSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="border border-rose-500/25 bg-rose-500/8 text-rose-300 rounded-xl p-4">
      <div className="text-xs text-rose-400 font-semibold uppercase tracking-wider mb-2">⚠ Fix the following:</div>
      <ul className="list-disc pl-5 space-y-0.5 text-sm">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
