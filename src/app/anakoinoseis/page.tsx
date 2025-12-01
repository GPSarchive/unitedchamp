// app/announcements/page.tsx
import AnnouncementsFeed from "@/app/anakoinoseis/AnnouncementsFeed";
import VantaBg from "@/app/lib/VantaBg";

export const metadata = { title: "Ανακοινώσεις" };

export default function AnnouncementsPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background that stays in place while content scrolls */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content scrolling over the fixed background */}
      <div className="relative z-10">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-center text-white tracking-tight">
            Ανακοινώσεις
          </h1>
          <AnnouncementsFeed pageSize={20} />
        </div>
      </div>
    </section>
  );
}
