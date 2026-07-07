"use client";

import type { StepDef, StepId } from "../builder/steps";

export type StepBadges = Partial<Record<StepId, { count?: number; tone: "error" | "dirty" }>>;

/** Fixed bottom bar on mobile; vertical side rail on lg+. */
export default function StepBar({
  steps,
  activeId,
  onSelect,
  badges = {},
}: {
  steps: StepDef[];
  activeId: StepId;
  onSelect: (id: StepId) => void;
  badges?: StepBadges;
}) {
  return (
    <>
      {/* Mobile: fixed bottom bar */}
      <nav
        aria-label="Βήματα"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0d12]/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          {steps.map((s, i) => (
            <StepButton
              key={s.id}
              step={s}
              index={i}
              active={s.id === activeId}
              badge={badges[s.id]}
              onSelect={onSelect}
              variant="bottom"
            />
          ))}
        </div>
      </nav>

      {/* Desktop: side rail */}
      <nav
        aria-label="Βήματα"
        className="hidden lg:block w-52 shrink-0"
      >
        <div className="sticky top-6 space-y-1">
          {steps.map((s, i) => (
            <StepButton
              key={s.id}
              step={s}
              index={i}
              active={s.id === activeId}
              badge={badges[s.id]}
              onSelect={onSelect}
              variant="rail"
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function StepButton({
  step,
  index,
  active,
  badge,
  onSelect,
  variant,
}: {
  step: StepDef;
  index: number;
  active: boolean;
  badge?: { count?: number; tone: "error" | "dirty" };
  onSelect: (id: StepId) => void;
  variant: "bottom" | "rail";
}) {
  const Icon = step.icon;
  const badgeDot =
    badge != null ? (
      <span
        className={[
          "absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold leading-none text-white",
          badge.tone === "error" ? "bg-rose-500" : "bg-indigo-500",
        ].join(" ")}
      >
        {badge.count != null && badge.count > 0 ? badge.count : ""}
      </span>
    ) : null;

  if (variant === "bottom") {
    return (
      <button
        onClick={() => onSelect(step.id)}
        aria-current={active ? "step" : undefined}
        className={[
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors",
          active ? "text-indigo-300" : "text-zinc-500 hover:text-zinc-300",
        ].join(" ")}
      >
        <span className="relative">
          <Icon size={20} strokeWidth={active ? 2.4 : 2} />
          {badgeDot}
        </span>
        {step.label}
        {active && (
          <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-indigo-400" aria-hidden />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(step.id)}
      aria-current={active ? "step" : undefined}
      className={[
        "relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-indigo-500/15 text-indigo-200"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white",
      ].join(" ")}
    >
      <span className="relative">
        <Icon size={18} />
        {badgeDot}
      </span>
      <span className="flex-1 text-left">{step.label}</span>
      <span className="text-[10px] text-zinc-600">{index + 1}</span>
    </button>
  );
}
