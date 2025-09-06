// app/tournoua/[slug]/components/StageGroupPicker.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Stage = { id: number; name: string; kind: "league" | "groups" | "knockout" };
type Group = { id: number; name: string };
type Props = {
  stages: Stage[];
  groupsByStage: Record<number, Group[]>;
};

export default function StageGroupPicker({ stages, groupsByStage }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const currentStage =
    Number(sp.get("stage_id") || stages?.[0]?.id || 0);
  const currentGroup =
    Number(sp.get("group_id") || 0);

  const go = (patch: { stage_id?: number; group_id?: number }) => {
    const p = new URLSearchParams(sp.toString());
    if (patch.stage_id !== undefined) {
      p.set("stage_id", String(patch.stage_id));
      // reset group when stage changes
      p.delete("group_id");
    }
    if (patch.group_id !== undefined) {
      if (patch.group_id) p.set("group_id", String(patch.group_id));
      else p.delete("group_id");
    }
    router.push(`?${p.toString()}`);
  };

  const groups = groupsByStage[currentStage] || [];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-white/60">Stage</label>
      <select
        className="bg-zinc-900 border border-white/15 rounded-md px-3 py-2"
        value={currentStage}
        onChange={(e) => go({ stage_id: Number(e.target.value), group_id: 0 })}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.kind})
          </option>
        ))}
      </select>

      {groups.length > 0 && (
        <>
          <label className="text-sm text-white/60">Όμιλος</label>
          <select
            className="bg-zinc-900 border border-white/15 rounded-md px-3 py-2"
            value={currentGroup}
            onChange={(e) => go({ group_id: Number(e.target.value) })}
          >
            <option value={0}>Όλοι</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
