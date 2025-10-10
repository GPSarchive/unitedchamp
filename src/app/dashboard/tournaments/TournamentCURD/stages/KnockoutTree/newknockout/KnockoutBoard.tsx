"use client";


 import BracketCanvas from "./BracketCanvas";


 type TeamsMap = Record<number | string, { name: string; logo?: string | null; seed?: number | null }>;

 export default function KnockoutBoard({
   stageIdx,
   teamsMap,

 }: {
   stageIdx: number;
   teamsMap: TeamsMap;

 }) {


   return (
     <div className="rounded-xl border border-white/10 p-3 bg-white/[0.03]">
       <BracketCanvas
         stageIdx={stageIdx}
         teamsMap={teamsMap}

       />
     </div>
   );
 }