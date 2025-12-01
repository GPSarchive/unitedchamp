// app/announcements/page.tsx
import AnnouncementsFeed from "@/app/anakoinoseis/AnnouncementsFeed";

export const metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return (
    <main className="relative min-h-dvh bg-black overflow-hidden">
      {/* Background gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FFD700]/5 via-transparent to-[#B38600]/5" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-4xl font-extrabold mb-2 text-center text-white tracking-tight">
          Ανακοινώσεις
        </h1>
        <p className="text-center text-white/60 mb-8 text-sm tracking-wide">
          Όλες οι τελευταίες ενημερώσεις
        </p>
        <AnnouncementsFeed pageSize={20} />
      </div>
    </main>
  );
}
