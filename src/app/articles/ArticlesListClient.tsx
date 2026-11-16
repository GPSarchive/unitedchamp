"use client";

/**
 * «Άρθρα & Ανακοινώσεις» (/articles). The page ground, header and filter
 * pills follow /tournaments; the cards are the flat boxes the page already had.
 *
 * Data: two fetches, merged, pinned first then newest first, and the
 * Όλα / Άρθρα / Ανακοινώσεις filter.
 */

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";
import {
  SURFACE,
  layers,
  LINE,
  CHIP,
  BUTTON_SHAPE,
} from "@/app/lib/ui/flat";

// ───────────────────────────────────────────────────────────────────────
// Typography (the same four faces as /tournaments)
// ───────────────────────────────────────────────────────────────────────
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────
type Article = {
  id: number;
  title: string;
  slug: string;
  content: any;
  excerpt: string | null;
  featured_image: string | null;
  published_at: string;
};

type Announcement = {
  id: number;
  title: string;
  body: string;
  format: "md" | "html" | "plain";
  start_at: string | null;
  created_at: string;
  pinned: boolean;
};

type UnifiedItem = {
  id: string;
  type: "article" | "announcement";
  title: string;
  excerpt: string;
  date: string;
  link: string;
  image?: string;
  pinned?: boolean;
};

type Filter = "all" | "articles" | "announcements";

// The two kinds' colours: sheets under the card, the label, the hover tint.
const BLUE = "#60a5fa";
const AMBER = "#f59e0b";

const pad2 = (n: number | string) => String(n).padStart(2, "0");

// Function to extract first image from TipTap JSON content
function extractFirstImage(content: any): string | null {
  if (!content) return null;

  try {
    // TipTap stores content as { type: 'doc', content: [...] }
    if (content.content && Array.isArray(content.content)) {
      for (const node of content.content) {
        // Check if this node is an image
        if (node.type === "image" && node.attrs?.src) {
          return node.attrs.src;
        }
        // Check nested content
        if (node.content && Array.isArray(node.content)) {
          for (const childNode of node.content) {
            if (childNode.type === "image" && childNode.attrs?.src) {
              return childNode.attrs.src;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting image from content:", error);
  }

  return null;
}

// ───────────────────────────────────────────────────────────────────────
// Page ground (static; replaces the Vanta animation)
// ───────────────────────────────────────────────────────────────────────
const PaperBackground: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
      }}
    />
    {/* orange signal halo top-left */}
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
      }}
    />
    {/* purple glow bottom-right */}
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
      }}
    />
    {/* fine grid */}
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.04]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="algrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#algrid)" />
    </svg>
    {/* grain */}
    <svg
      className="absolute inset-0 h-full w-full mix-blend-screen opacity-[0.08]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <filter id="alnoise">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.4 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#alnoise)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Page header
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC<{
  loading: boolean;
  articles: number;
  announcements: number;
}> = ({ loading, articles, announcements }) => (
  <header className={`relative border-b ${LINE}`}>
    <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-6 sm:px-6 md:pt-10 md:pb-8">
      {/* breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="transition-colors hover:text-[#fb923c]">
          Αρχική
        </Link>
        <span>/</span>
        <span className="text-[#F3EFE6]">Άρθρα</span>
      </nav>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
            <span className="h-[2px] w-8 bg-[#fb923c]" />
            Νέα
          </div>
          <h1
            className="mt-2 font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] text-[#F3EFE6]"
            style={{ fontSize: "clamp(2rem, 5.5vw, 4rem)" }}
          >
            Άρθρα &amp; Ανακοινώσεις
          </h1>
          <p className="mt-3 max-w-xl font-[var(--f-body)] text-sm leading-relaxed text-[#F3EFE6]/60 md:text-base">
            Διαβάστε τα τελευταία νέα, αναλύσεις αγώνων και σημαντικές ανακοινώσεις
          </p>
        </div>

        {!loading && (
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
            <span className={`inline-flex items-center gap-2 ${CHIP} px-2.5 py-1`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: BLUE }} />
              Άρθρα · {pad2(articles)}
            </span>
            <span className={`inline-flex items-center gap-2 ${CHIP} px-2.5 py-1`}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
              Ανακοινώσεις · {pad2(announcements)}
            </span>
          </div>
        )}
      </div>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Filter pills
// ───────────────────────────────────────────────────────────────────────
const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "all", label: "Όλα" },
  { value: "articles", label: "Άρθρα", dot: BLUE },
  { value: "announcements", label: "Ανακοινώσεις", dot: AMBER },
];

const FilterPills: React.FC<{
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: Record<Filter, number>;
}> = ({ filter, setFilter, counts }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label="Φίλτρο περιεχομένου">
    {FILTERS.map((f) => {
      const active = filter === f.value;
      return (
        <button
          key={f.value}
          type="button"
          onClick={() => setFilter(f.value)}
          aria-pressed={active}
          className={`flex min-h-[36px] items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] ${
            active
              ? "rounded-lg bg-[#fb923c] text-[#0a0a14]"
              : `${BUTTON_SHAPE} text-[#F3EFE6]/70 hover:text-[#F3EFE6]`
          }`}
        >
          {f.dot && (
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: active ? "#0a0a14" : f.dot }}
            />
          )}
          <span>{f.label}</span>
          <span
            className={`font-[var(--f-brutal)] text-xs ${
              active ? "text-[#0a0a14]" : "text-[#F3EFE6]"
            }`}
          >
            {pad2(counts[f.value])}
          </span>
        </button>
      );
    })}
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Cards, loading and empty state: the flat boxes /articles already had.
// ───────────────────────────────────────────────────────────────────────
// Announcement bodies are markdown: on a card they are plain text, so drop
// the markdown marks and the emojis the notice templates put in.
const plainExcerpt = (text: string) =>
  text
    .replace(/[*_`~#>]+/g, "")
    .replace(/[\p{Extended_Pictographic}️‍]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const liveDate = (iso: string) =>
  new Date(iso).toLocaleDateString("el-GR", { year: "numeric", month: "short", day: "numeric" });

const AnnouncementCard: React.FC<{ item: UnifiedItem }> = ({ item }) => {
  const publishedDate = liveDate(item.date);
  return (
    <Link href={item.link} className="group block">
      <article className={`h-full ${SURFACE} transition-all duration-500 hover:scale-[1.03] p-6`} style={{ boxShadow: layers('#f59e0b') }}>
        {/* Header with Badge and Pin */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide bg-amber-500 text-white">
            Ανακοίνωση
          </span>
          {item.pinned && (
            <span className="text-xs px-3 py-1 rounded-full bg-white/90 text-neutral-700 font-medium">
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
            {plainExcerpt(item.excerpt)}
          </p>
        )}
      </article>
    </Link>
  );
};

const ArticleCard: React.FC<{ item: UnifiedItem }> = ({ item }) => {
  const publishedDate = liveDate(item.date);
  return (
    <Link href={item.link} className="group block">
      <article className={`relative h-full ${SURFACE} overflow-hidden transition-all duration-500 hover:scale-[1.03] hover:-translate-y-1`} style={{ boxShadow: layers('#3b82f6') }}>
        {/* Content Type Badge & Pin */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
          <span className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wide bg-blue-600 text-white">
            Άρθρο
          </span>
          {item.pinned && (
            <span className="text-xs px-3 py-1 rounded-full bg-white/90 text-neutral-700 font-medium">
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
};

const LoadingGrid: React.FC = () => (
  <div className="text-center py-20">
    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white"></div>
    <p className="mt-4 text-white/90">Φόρτωση...</p>
  </div>
);

const EmptyState: React.FC = () => (
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
);

// ───────────────────────────────────────────────────────────────────────
// MAIN
// ───────────────────────────────────────────────────────────────────────
export default function ArticlesListClient() {
  const [items, setItems] = useState<UnifiedItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      setLoading(true);
      try {
        // Fetch articles
        const articlesRes = await fetch("/api/articles-public");
        const articlesData = await articlesRes.json();
        const articles: Article[] = articlesData.articles || [];

        // Fetch announcements
        const announcementsRes = await fetch("/api/announcements?active=1&offset=0&limit=50");
        const announcementsData = await announcementsRes.json();
        const announcements: Announcement[] = announcementsData.data || [];

        // Transform articles
        const articleItems: UnifiedItem[] = articles.map((article) => {
          // Get featured image or extract first image from content
          const image = article.featured_image || extractFirstImage(article.content);

          return {
            id: `article-${article.id}`,
            type: "article" as const,
            title: article.title,
            excerpt: article.excerpt || "",
            date: article.published_at,
            link: `/article/${article.slug}`,
            image: image || undefined,
          };
        });

        // Transform announcements
        const announcementItems: UnifiedItem[] = announcements.map((ann) => ({
          id: `announcement-${ann.id}`,
          type: "announcement" as const,
          title: ann.title,
          excerpt: ann.body.substring(0, 200) + (ann.body.length > 200 ? "..." : ""),
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

        setItems(combined);
      } catch (error) {
        console.error("Error fetching content:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "articles") return item.type === "article";
    if (filter === "announcements") return item.type === "announcement";
    return true;
  });

  const articlesCount = items.filter((i) => i.type === "article").length;
  const announcementsCount = items.filter((i) => i.type === "announcement").length;
  const counts: Record<Filter, number> = {
    all: items.length,
    articles: articlesCount,
    announcements: announcementsCount,
  };

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader
        loading={loading}
        articles={articlesCount}
        announcements={announcementsCount}
      />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 md:py-12">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPills filter={filter} setFilter={setFilter} counts={counts} />
            {!loading && (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50 sm:inline">
                {pad2(filteredItems.length)} / {pad2(items.length)}
              </span>
            )}
          </div>

          {loading ? (
            <LoadingGrid />
          ) : filteredItems.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredItems.map((item) =>
                item.type === "announcement" ? (
                  <AnnouncementCard key={item.id} item={item} />
                ) : (
                  <ArticleCard key={item.id} item={item} />
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
