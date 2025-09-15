//app/components/DashboardPageComponents/TournamentCURD/shared/ValidationSummary.tsx
"use client";

export default function ValidationSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-md border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
      <div className="font-semibold mb-1">Fix the following:</div>
      <ul className="list-disc pl-5 space-y-0.5">
        {errors.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </div>
  );
}
