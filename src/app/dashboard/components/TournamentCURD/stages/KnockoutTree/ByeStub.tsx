// app/components/DashboardPageComponents/TournamentCURD/stages/ModernKnockoutTree/components/ByeStub.tsx
"use client";

export function ByeStub({
  id,
  setNodeRef,
  translateY,
}: {
  id: number;
  setNodeRef: (id: number) => (el: HTMLDivElement | null) => void;
  translateY: number;
}) {
  return (
    <div
      ref={setNodeRef(id)}
      className="relative rounded-md border border-white/10 bg-white/5 text-white/60 text-xs px-2 py-1 w-[160px] mx-1"
      style={{ transform: `translateY(${translateY}px)` }}
    >
      BYE
    </div>
  );
}
