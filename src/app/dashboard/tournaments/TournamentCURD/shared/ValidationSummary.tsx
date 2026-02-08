//app/dashboard/tournaments/TournamentCURD/shared/ValidationSummary.tsx
"use client";

export default function ValidationSummary({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-gradient-to-r from-rose-500/10 to-red-500/10 p-4 text-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-400/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-rose-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="font-semibold text-rose-200">Please fix the following issues</div>
      </div>
      <ul className="space-y-1 pl-9">
        {errors.map((e, i) => (
          <li key={i} className="text-rose-200/80 flex items-start gap-2">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400/50 flex-shrink-0" />
            <span>{e}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
