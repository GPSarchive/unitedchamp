// Class recipes for Builder 2.0 — seeded from the informal recipes in
// stages/StageCard.tsx so the preview matches the existing admin theme.

export const field =
  "w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white placeholder-zinc-500 " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/60 transition-colors " +
  "min-h-11 text-base sm:text-sm";

export const select = field;

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-lg text-sm font-semibold " +
  "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-colors";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm font-medium " +
  "text-zinc-200 hover:text-white hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 " +
  "disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 min-h-11 px-3 py-2 rounded-lg text-sm font-medium " +
  "border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 " +
  "disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-rose-500/40 transition-colors";

export const card =
  "rounded-2xl border border-white/8 bg-[#0d0f14] shadow-xl";

export const chip =
  "inline-flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold " +
  "uppercase tracking-wider text-zinc-400";

export const helperText = "mt-1 text-xs text-zinc-500";
