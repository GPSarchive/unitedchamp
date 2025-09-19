"use client";

type KOMatchLite = { id: number; round: number | null; bracket_pos: number | null };
type Intake = {
  group_idx: number;
  slot_idx: number;
  round: number;
  bracket_pos: number;
  outcome: "W" | "L";
};

export default function GroupIntakeBoard({
  groups,
  koMatches: _koMatches, // kept for future use; underscore to avoid lint error if unused
  intake,
}: {
  groups: Array<{ name: string }>;
  koMatches: KOMatchLite[];
  intake: Intake[];
}) {
  const labelFor = (it: Intake) => {
    const round = it.round ?? "?";
    const pos = it.bracket_pos ?? "?";
    return `${it.outcome} R${round}•M${pos}`;
  };

  // Build a grid: group -> list of slots -> label
  const slotsPerGroup: Record<number, string[]> = {};
  groups.forEach((_g, gi) => (slotsPerGroup[gi] = []));
  intake.forEach((it) => {
    const lbl = labelFor(it);
    const arr = slotsPerGroup[it.group_idx] ?? (slotsPerGroup[it.group_idx] = []);
    arr[it.slot_idx] = lbl;
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {groups.map((g, gi) => {
        const slots = (slotsPerGroup[gi] ?? []).slice();
        const maxSlots = slots.length; // <-- show "No intake defined" when 0
        return (
          <div key={gi} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="font-medium text-white/90 mb-2">
              {g.name ?? `Group ${gi + 1}`}
            </div>
            {maxSlots === 0 ? (
              <div className="text-white/60 text-sm">No intake defined.</div>
            ) : (
              <ul className="space-y-1">
                {Array.from({ length: maxSlots }).map((_, si) => (
                  <li
                    key={si}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-sm"
                    title="Source from knockout"
                  >
                    <span className="text-white/80">Slot {si + 1}</span>
                    <span className="text-white/70">{slots[si] ?? "TBD"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
