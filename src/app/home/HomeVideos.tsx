"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

type VideoMatch = {
  id: number;
  video_url: string;
  team_a_name: string | null;
  team_b_name: string | null;
  team_a_logo: string | null;
  team_b_logo: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  match_date: string | null;
  tournament_name: string | null;
};

type HomeVideosProps = {
  videos: VideoMatch[];
};

const ITEMS_PER_PAGE = 4;

function extractYouTubeId(url: string): string | null {
  try {
    // Handle youtu.be short links
    const shortMatch = url.match(
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    if (shortMatch) return shortMatch[1];

    // Handle youtube.com/watch?v= and youtube.com/embed/
    const longMatch = url.match(
      /(?:youtube\.com\/(?:watch\?.*v=|embed\/))([a-zA-Z0-9_-]{11})/
    );
    if (longMatch) return longMatch[1];

    // Handle bare video ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  } catch {}
  return null;
}

function getThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function getEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}

export default function HomeVideos({ videos }: HomeVideosProps) {
  const [page, setPage] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (videos.length === 0) return null;

  const totalPages = Math.ceil(videos.length / ITEMS_PER_PAGE);
  const start = page * ITEMS_PER_PAGE;
  const visible = videos.slice(start, start + ITEMS_PER_PAGE);

  const prev = () => {
    setPage((p) => Math.max(0, p - 1));
    setPlayingId(null);
  };
  const next = () => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
    setPlayingId(null);
  };

  return (
    <section className="relative py-20 sm:py-32 overflow-hidden bg-zinc-950">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-orange-500/10 blur-[180px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-500/8 blur-[160px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10 max-w-7xl">
        {/* Section title */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            ΒΙΝΤΕΟ
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto" />
          <p className="mt-5 text-base sm:text-lg text-gray-400 font-light">
            Στιγμιότυπα από τους αγώνες μας
          </p>
        </div>

        {/* 2-col grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5 lg:gap-6">
          {visible.map((match) => {
            const videoId = extractYouTubeId(match.video_url);
            if (!videoId) return null;

            const isPlaying = playingId === videoId;
            const matchDate = match.match_date
              ? new Date(match.match_date).toLocaleDateString("el-GR", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <div
                key={match.id}
                className="group relative flex flex-col bg-gradient-to-b from-neutral-900 to-black border-2 border-white/10 overflow-hidden transition-all duration-500 hover:border-orange-500/50 hover:shadow-[0_0_40px_rgba(249,115,22,0.3)]"
              >
                {/* Video area */}
                <div className="relative aspect-video overflow-hidden">
                  {isPlaying ? (
                    <iframe
                      src={getEmbedUrl(videoId)}
                      title={`${match.team_a_name ?? "Team A"} vs ${match.team_b_name ?? "Team B"}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute inset-0 w-full h-full"
                    />
                  ) : (
                    <>
                      <img
                        src={getThumbnailUrl(videoId)}
                        alt={`${match.team_a_name ?? ""} vs ${match.team_b_name ?? ""}`}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      {/* Dark overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      {/* Play button */}
                      <button
                        onClick={() => setPlayingId(videoId)}
                        aria-label="Play video"
                        className="absolute inset-0 flex items-center justify-center cursor-pointer"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-orange-500/90 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-lg shadow-orange-500/30">
                          <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white ml-0.5" />
                        </div>
                      </button>
                      {/* Score overlay */}
                      {match.team_a_score != null && match.team_b_score != null && (
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-black/70 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-bold text-white tracking-wider">
                          {match.team_a_score} – {match.team_b_score}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Match info */}
                <div className="flex flex-col flex-1 p-3 sm:p-4 lg:p-5">
                  {/* Date & tournament */}
                  <div className="flex items-center gap-2 mb-2">
                    {matchDate && (
                      <span className="text-[11px] text-gray-500 uppercase tracking-wider">
                        {matchDate}
                      </span>
                    )}
                    {match.tournament_name && (
                      <>
                        <span className="text-gray-600">·</span>
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider truncate">
                          {match.tournament_name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Teams */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {match.team_a_logo && (
                        <img
                          src={match.team_a_logo}
                          alt=""
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0"
                        />
                      )}
                      <span className="text-sm sm:text-base font-semibold text-white truncate">
                        {match.team_a_name ?? "TBD"}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium flex-shrink-0">
                      vs
                    </span>
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                      <span className="text-sm sm:text-base font-semibold text-white truncate text-right">
                        {match.team_b_name ?? "TBD"}
                      </span>
                      {match.team_b_logo && (
                        <img
                          src={match.team_b_logo}
                          alt=""
                          className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover ring-1 ring-white/20 flex-shrink-0"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Corner bracket accents (hover) */}
                <div className="absolute top-0 left-0 w-6 h-6 sm:w-8 sm:h-8 border-t-2 border-l-2 border-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-6 h-6 sm:w-8 sm:h-8 border-b-2 border-r-2 border-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            );
          })}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 sm:mt-12 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              disabled={page === 0}
              aria-label="Previous page"
              className="p-2.5 sm:p-3 border-2 border-white/10 text-white/70 hover:text-white hover:border-orange-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPage(i);
                    setPlayingId(null);
                  }}
                  aria-label={`Page ${i + 1}`}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === page
                      ? "bg-orange-500 scale-125"
                      : "bg-white/20 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={page === totalPages - 1}
              aria-label="Next page"
              className="p-2.5 sm:p-3 border-2 border-white/10 text-white/70 hover:text-white hover:border-orange-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
