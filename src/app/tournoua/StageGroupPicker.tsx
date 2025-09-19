"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function StageGroupPicker({ stages, groupsByStage }:{
  stages: { id:number; name:string; kind:"league"|"groups"|"knockout"}[];
  groupsByStage: Record<number,{ id:number; name:string}[]>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const stage_id = Number(sp.get("stage_id") || stages?.[0]?.id || 0);
  const group_id = Number(sp.get("group_id") || 0);

  const go = (next:{stage_id?:number; group_id?:number}) => {
    const p = new URLSearchParams(sp);
    if (next.stage_id !== undefined) p.set("stage_id", String(next.stage_id));
    if (next.group_id !== undefined) {
      if (next.group_id) p.set("group_id", String(next.group_id));
      else p.delete("group_id");
    }
    router.push(`?${p.toString()}`);
  };

  const groups = groupsByStage[stage_id] || [];

  return (
    <div className="flex flex-wrap gap-3">
      <select className="bg-zinc-900 border border-white/15 rounded-md px-3 py-2"
              value={stage_id} onChange={e=>go({stage_id:Number(e.target.value), group_id:0})}>
        {stages.map(s => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
      </select>

      {groups.length > 0 && (
        <select className="bg-zinc-900 border border-white/15 rounded-md px-3 py-2"
                value={group_id} onChange={e=>go({group_id:Number(e.target.value)})}>
          <option value={0}>Όλοι οι Όμιλοι</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      )}
    </div>
  );
}
