"use client";

export type Segment = { id: string; label: string; badge?: string | number };

export default function SegmentedControl({
  segments,
  activeId,
  onSelect,
  className = "",
}: {
  segments: Segment[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {segments.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            className={[
              "shrink-0 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium min-h-10 transition-colors",
              active
                ? "border-indigo-500/50 bg-indigo-500/15 text-indigo-200"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800",
            ].join(" ")}
          >
            {s.label}
            {s.badge != null && s.badge !== "" ? (
              <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                {s.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
