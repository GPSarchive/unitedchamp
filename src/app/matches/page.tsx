// app/matches/page.tsx - REVAMPED with existing components

import AnimatedHeroBg from "@/components/ui/AnimatedHeroBg";
import RecentMatchesTabs from "../home/RecentMatchesTabs";

export const revalidate = 60;

export const metadata = {
  title: "Αγώνες | Ultra Champ",
  description: "Φίλτραρε αγώνες ανά ομάδα, διοργάνωση και ημερομηνία.",
};

export default async function MatchesPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      {/* Hero Section */}
      <section className="relative min-h-[30vh] flex items-center justify-center overflow-hidden">
        <AnimatedHeroBg variant="matches" />

        <div className="relative z-10 container mx-auto max-w-6xl px-4 py-12 text-center">
          {/* Section Tag */}
          <span className="inline-block mb-4 text-[11px] font-mono font-bold tracking-[0.2em] text-amber-400 uppercase">
            ΑΓΩΝΕΣ
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 leading-[0.95] tracking-tight">
            Πρόγραμμα &amp; Αποτελέσματα
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-white/70 max-w-xl mx-auto">
            Όλοι οι αγώνες του UltraChamp σε πραγματικό χρόνο
          </p>
        </div>
      </section>

      {/* Matches List - Using existing RecentMatchesTabs */}
      <section className="py-8">
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="w-full pointer-events-auto">
            <RecentMatchesTabs
              className="mt-0"
              pageSize={12}
              variant="transparent"
              maxWClass="max-w-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
