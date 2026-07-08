"use client";

type Tone = "neutral" | "indigo" | "emerald" | "rose" | "amber";

const tones: Record<Tone, string> = {
  neutral: "bg-zinc-800 text-zinc-300 border-zinc-700",
  indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  rose: "bg-rose-500/10 text-rose-300 border-rose-500/30",
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export default function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
