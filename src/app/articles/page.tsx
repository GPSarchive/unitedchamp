'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { calculateReadTime, formatViewCount, formatReadTime } from '@/lib/articleUtils';
import VantaBg from '@/app/lib/VantaBg';

type Article = {
  id: number;
  title: string;
  slug: string;
  content: any;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string;
  view_count: number;
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  format: 'md' | 'html' | 'plain';
  start_at: string | null;
  created_at: string;
  pinned: boolean;
};

type UnifiedItem = {
  id: string;
  type: 'article' | 'announcement';
  title: string;
  excerpt: string;
  date: string;
  link: string;
  image?: string;
  metadata?: {
    readTime?: number;
    viewCount?: number;
  };
  pinned?: boolean;
};

// Function to extract first image from TipTap JSON content
function extractFirstImage(content: any): string | null {
  if (!content) return null;

  try {
    // TipTap stores content as { type: 'doc', content: [...] }
    if (content.content && Array.isArray(content.content)) {
      for (const node of content.content) {
        // Check if this node is an image
        if (node.type === 'image' && node.attrs?.src) {
          return node.attrs.src;
        }
        // Check nested content
        if (node.content && Array.isArray(node.content)) {
          for (const childNode of node.content) {
            if (childNode.type === 'image' && childNode.attrs?.src) {
              return childNode.attrs.src;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error extracting image from content:', error);
  }

  return null;
}

export default function UnifiedContentPage() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'articles' | 'announcements'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      setLoading(true);
      try {
        // Fetch articles
        const articlesRes = await fetch('/api/articles-public');
        const articlesData = await articlesRes.json();
        console.log('Articles data:', articlesData);
        const articles: Article[] = articlesData.articles || [];

        // Fetch announcements
        const announcementsRes = await fetch('/api/announcements?active=1&offset=0&limit=50');
        const announcementsData = await announcementsRes.json();
        console.log('Announcements data:', announcementsData);
        const announcements: Announcement[] = announcementsData.data || [];

        // Transform articles
        const articleItems: UnifiedItem[] = articles.map(article => {
          // Get featured image or extract first image from content
          const image = article.featured_image || extractFirstImage(article.content);

          return {
            id: `article-${article.id}`,
            type: 'article' as const,
            title: article.title,
            excerpt: article.excerpt || '',
            date: article.published_at,
            link: `/article/${article.slug}`,
            image: image || undefined,
            metadata: {
              readTime: calculateReadTime(article.content),
              viewCount: article.view_count || 0,
            },
          };
        });

        // Transform announcements
        const announcementItems: UnifiedItem[] = announcements.map(ann => ({
          id: `announcement-${ann.id}`,
          type: 'announcement' as const,
          title: ann.title,
          excerpt: ann.body.substring(0, 200) + (ann.body.length > 200 ? '...' : ''),
          date: ann.start_at || ann.created_at,
          link: `/announcement/${ann.id}`,
          pinned: ann.pinned,
        }));

        // Combine and sort by date (newest first), with pinned items first
        const combined = [...articleItems, ...announcementItems].sort((a, b) => {
          // Pinned items always first
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;

          // Then sort by date
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        console.log('Combined items:', combined);
        setItems(combined);
      } catch (error) {
        console.error('Error fetching content:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, []);

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'articles') return item.type === 'article';
    if (filter === 'announcements') return item.type === 'announcement';
    return true;
  });

  const articlesCount = items.filter(i => i.type === 'article').length;
  const announcementsCount = items.filter(i => i.type === 'announcement').length;

  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content scrolling over the fixed background */}
      <div className="relative z-10">
        {/* Header */}
        <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
                Άρθρα & Ανακοινώσεις
              </h1>
              <p className="text-xl text-white/90 max-w-2xl mx-auto">
                Διαβάστε τα τελευταία νέα, αναλύσεις αγώνων και σημαντικές ανακοινώσεις
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="border-b border-white/10 bg-black/30 backdrop-blur-sm sticky top-0 z-20 shadow-lg">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-2 py-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-white text-neutral-900'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                Όλα
              </button>
              <button
                onClick={() => setFilter('articles')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  filter === 'articles'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                Άρθρα
              </button>
              <button
                onClick={() => setFilter('announcements')}
                className={`px-6 py-2 rounded-lg font-medium transition-all ${
                  filter === 'announcements'
                    ? 'bg-amber-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }`}
              >
                Ανακοινώσεις
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="max-w-7xl mx-auto px-4 py-16">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
              <p className="mt-4 text-white/90">Φόρτωση...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-block p-6 rounded-full bg-white/10 backdrop-blur-sm mb-6">
                <svg
                  className="w-16 h-16 text-white/60"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Δεν υπάρχει περιεχόμενο</h2>
              <p className="text-white/75">Το περιεχόμενο θα εμφανιστεί εδώ μόλις δημοσιευτεί</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredItems.map((item) => {
                const publishedDate = new Date(item.date).toLocaleDateString('el-GR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });

                // Different layout for announcements vs articles
                if (item.type === 'announcement') {
                  return (
                    <Link
                      key={item.id}
                      href={item.link}
                      className="group block"
                    >
                      <article className="h-full bg-black/80 backdrop-blur-lg rounded-2xl border-2 border-white/20 hover:border-amber-500 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_20px_60px_-15px_rgba(245,158,11,0.5)] p-6">
                        {/* Header with Badge and Pin */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide shadow-lg bg-amber-500 text-white">
                            Ανακοίνωση
                          </span>
                          {item.pinned && (
                            <span className="text-xs px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-white/30 text-neutral-700 font-medium shadow-lg">
                              📌 Pinned
                            </span>
                          )}
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-2 mb-4 text-xs text-white/60">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <time dateTime={item.date}>{publishedDate}</time>
                        </div>

                        {/* Title */}
                        <h2 className="text-xl font-semibold text-white mb-4 group-hover:text-amber-300 transition-colors duration-300">
                          {item.title}
                        </h2>

                        {/* Excerpt */}
                        {item.excerpt && (
                          <p className="text-white/75 mb-0 leading-relaxed line-clamp-4">
                            {item.excerpt}
                          </p>
                        )}
                      </article>
                    </Link>
                  );
                }

                // Article layout with image
                return (
                  <Link
                    key={item.id}
                    href={item.link}
                    className="group block"
                  >
                    <article className="h-full bg-black/60 backdrop-blur-lg rounded-xl overflow-hidden border-2 border-white/20 hover:border-blue-500 transition-all duration-500 hover:scale-[1.03] hover:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] hover:-translate-y-1">
                      {/* Content Type Badge & Pin */}
                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                        <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide shadow-lg bg-blue-600 text-white">
                          Άρθρο
                        </span>
                        {item.pinned && (
                          <span className="text-xs px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-white/30 text-neutral-700 font-medium shadow-lg">
                            📌 Pinned
                          </span>
                        )}
                      </div>

                      {/* Image */}
                      {item.image ? (
                        <div className="aspect-video w-full overflow-hidden bg-neutral-900 relative">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-gradient-to-br from-neutral-900 to-black flex items-center justify-center relative">
                          <svg
                            className="w-20 h-20 text-white/30 transition-transform duration-500 group-hover:scale-110"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Content */}
                      <div className="p-6">
                        {/* Metadata */}
                        <div className="flex items-center gap-3 mb-4 text-xs text-white/70">
                          <time className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {publishedDate}
                          </time>

                          {item.metadata?.readTime && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatReadTime(item.metadata.readTime)}
                            </span>
                          )}

                          {item.metadata?.viewCount !== undefined && (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              {formatViewCount(item.metadata.viewCount)}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h2 className="text-2xl font-bold text-white mb-3 line-clamp-2 group-hover:text-blue-400 transition-colors duration-300">
                          {item.title}
                        </h2>

                        {/* Excerpt */}
                        {item.excerpt && (
                          <p className="text-white/80 mb-4 line-clamp-3 leading-relaxed">
                            {item.excerpt}
                          </p>
                        )}

                        {/* Read More */}
                        <div className="flex items-center gap-2 text-blue-400 font-medium group-hover:gap-3 transition-all duration-300">
                          <span>Διαβάστε περισσότερα</span>
                          <svg
                            className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
