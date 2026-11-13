import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import AnnouncementContent from '@/components/AnnouncementContent';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Rendered per request, as before (it used to be dynamic implicitly, through
// the cookie-bound client).
export const dynamic = 'force-dynamic';

// Read with the service role: the anon key has no table access
// (migrations/lock-anon-reads.sql), so the status = 'published' filter below
// is what keeps drafts private — do not remove it.
async function getAnnouncement(id: string) {
  try {
    // Convert string ID to number
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      console.log(`Invalid announcement ID: ${id}`);
      return null;
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('id', numericId)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error(`Error fetching announcement ${numericId}:`, error);
      return null;
    }

    if (!data) {
      console.log(`No announcement found with ID ${numericId}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error in getAnnouncement:', err);
    return null;
  }
}


export async function generateMetadata({ params }: PageProps) {
  try {
    const { id } = await params;
    const announcement = await getAnnouncement(id);

    if (!announcement) {
      return {
        title: 'Announcement Not Found',
      };
    }

    return {
      title: announcement.title ?? 'Announcement',
      description: (announcement.body ?? '').substring(0, 160),
    };
  } catch (error) {
    console.error('Error generating announcement metadata:', error);
    return {
      title: 'Announcement',
    };
  }
}

export default async function AnnouncementPage({ params }: PageProps) {
  try {
    const { id } = await params;
    const announcement = await getAnnouncement(id);

    if (!announcement) {
      notFound();
    }

    const displayDate = announcement.start_at || announcement.created_at;
    const formattedDate = displayDate
      ? new Date(displayDate).toLocaleDateString('el-GR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header with back navigation */}
      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <a
            href="/articles"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            ← Πίσω στα Άρθρα & Ανακοινώσεις
          </a>
        </div>
      </div>

      {/* Announcement content */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* White content container */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Announcement content wrapper with padding */}
          <div className="px-8 md:px-12 py-10">
            {/* Announcement header */}
            <header className="mb-8 pb-8 border-b border-neutral-200">
              {/* Badge */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs px-3 py-1 rounded-full bg-amber-500 text-white font-bold uppercase tracking-wide">
                  Ανακοίνωση
                </span>
                {announcement.pinned && (
                  <span className="text-xs px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium">
                    📌 Pinned
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4 leading-tight">
                {announcement.title}
              </h1>

              {/* Announcement metadata */}
              <div className="flex items-center gap-4 flex-wrap text-sm text-neutral-500">
                {formattedDate && (
                  <time className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formattedDate}
                  </time>
                )}
              </div>
            </header>

            {/* Announcement content */}
            <AnnouncementContent body={announcement.body} format={announcement.format} />
          </div>
        </div>

        {/* Announcement footer */}
        <footer className="mt-12 pt-8 border-t border-neutral-200">
          <div className="flex items-center justify-between">
            <a
              href="/articles"
              className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              ← Πίσω στα Άρθρα & Ανακοινώσεις
            </a>
          </div>
        </footer>
      </article>
    </div>
  );
  } catch (error) {
    console.error('Error rendering announcement:', error);
    notFound();
  }
}
