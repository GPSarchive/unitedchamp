import { notFound } from 'next/navigation';
import { createSupabaseRSCClient } from '@/app/lib/supabase/supabaseServer';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getAnnouncement(id: string) {
  try {
    const supabase = await createSupabaseRSCClient();

    // Convert string ID to number
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      console.log(`Invalid announcement ID: ${id}`);
      return null;
    }

    const { data, error } = await supabase
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

function renderBody(body: string | null, format: 'md' | 'html' | 'plain' | null | undefined) {
  // Handle null/undefined body
  const safeBody = body ?? '';

  // Default to 'plain' if format is null/undefined
  const safeFormat = format ?? 'plain';

  if (safeFormat === 'html') {
    return DOMPurify.sanitize(safeBody);
  }
  if (safeFormat === 'md') {
    const html = marked.parse(safeBody, { async: false }) as string;
    return DOMPurify.sanitize(html);
  }
  // plain
  return safeBody.replace(/\n/g, '<br/>');
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

    const contentHTML = renderBody(announcement.body, announcement.format);

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
            <div
              className="prose prose-lg max-w-none
                prose-headings:text-neutral-900 prose-headings:font-bold
                prose-h1:text-3xl prose-h1:mb-4
                prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-8
                prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-6
                prose-p:text-neutral-700 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline hover:prose-a:text-blue-700
                prose-strong:text-neutral-900 prose-strong:font-semibold
                prose-ul:text-neutral-700 prose-ul:list-disc prose-ul:pl-6
                prose-ol:text-neutral-700 prose-ol:list-decimal prose-ol:pl-6
                prose-li:mb-2 prose-li:text-neutral-700
                prose-blockquote:border-l-4 prose-blockquote:border-amber-500
                prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600 prose-blockquote:bg-neutral-50
                prose-code:text-emerald-600 prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-800 prose-pre:rounded-lg prose-pre:p-4
                prose-img:rounded-lg prose-img:shadow-lg"
              dangerouslySetInnerHTML={{ __html: contentHTML }}
            />
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
