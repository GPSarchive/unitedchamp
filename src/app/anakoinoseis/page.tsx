// app/announcements/page.tsx
import AnnouncementsFeed from "@/app/components/announcements/AnnouncementsFeed";

export const metadata = { title: "Announcements" };

export default function AnnouncementsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Announcements</h1>
      <AnnouncementsFeed pageSize={20} />
    </main>
  );
}
