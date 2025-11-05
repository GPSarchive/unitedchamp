
// app/matches/page.tsx

import GridBgSection from "@/app/home/GridBgSection";
import RecentMatchesTabs from "../home/RecentMatchesTabs";


export const revalidate = 60;


export const metadata = {
title: "Αγώνες | Ultra Champ",
description: "Φίλτραρε αγώνες ανά ομάδα, διοργάνωση και ημερομηνία.",
};


export default async function MatchesPage() {
// Data is fetched server-side inside MatchesExplorerServer using supabaseAdmin
return (
<div className="min-h-screen bg-zinc-950 text-white">
<header className="mx-auto w-full max-w-7xl px-4 pt-10 pb-6">
<h1 className="text-3xl sm:text-4xl font-bold">Αγώνες</h1>
<p className="mt-2 text-white/70">Φίλτρα ανά ομάδα, διοργάνωση και ημερομηνία.</p>
</header>


<GridBgSection className="py-4">
<div className="mx-auto w-full max-w-7xl px-4">
<div className="w-full sm:max-w-[440px] md:max-w-[440px] lg:max-w-[880px] pointer-events-auto">
              <RecentMatchesTabs
                className="mt-10 lg:mt-0"
                pageSize={12}
                variant="transparent"
                maxWClass="max-w-none"
              />
            </div>
          </div>
          </GridBgSection>
        </div>
      

);
}