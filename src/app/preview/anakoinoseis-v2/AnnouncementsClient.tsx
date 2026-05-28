"use client";

/**
 * Announcements feed — editorial sports-broadsheet × kinetic brutalism.
 * Same atmosphere/typography as /OMADA/[id]: dark ground, ivory ink, orange signal,
 * saffron honours, 2px borders with offset hard shadows, mono labels, italic display.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import { marked } from "marked";
import DOMPurify from "dompurify";

// ───────────────────────────────────────────────────────────────────────
// Typography (same set as the team page)
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
type Announcement = {
  id: number;
  title: string;
  body: string;
  format: "md" | "html" | "plain";
  start_at: string | null;
  created_at: string;
  pinned: boolean;
};

type FilterKey = "all" | "pinned" | "recent";

const PAGE_SIZE = 10;

marked.setOptions({ gfm: true, breaks: true, async: false });

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function fmtFullDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("el-GR", {
    timeZone: "Europe/Athens",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDay(d: string | null | undefined) {
  if (!d) return { d: "—", m: "" };
  const date = new Date(d);
  return {
    d: String(date.getDate()).padStart(2, "0"),
    m: date.toLocaleDateString("el-GR", { month: "short" }).toUpperCase(),
  };
}

function fmtTime(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("el-GR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderBody(a: Announcement) {
  if (a.format === "html") {
    return { __html: DOMPurify.sanitize(a.body) };
  }
  if (a.format === "md") {
    const html = marked.parse(a.body, { async: false }) as string;
    return { __html: DOMPurify.sanitize(html) };
  }
  return { __html: a.body.replace(/\n/g, "<br/>") };
}

// ───────────────────────────────────────────────────────────────────────
// Atmosphere — same PaperBackground used on /OMADA/[id]
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
    <div
      className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
      }}
    />
    <div
      className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
      style={{
        background:
          "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
      }}
    />
    <svg
      className="absolute inset-0 h-full w-full opacity-[0.04]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="anngrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#anngrid)" />
    </svg>
  </div>
);

// ───────────────────────────────────────────────────────────────────────
// Page header / breadcrumb
// ───────────────────────────────────────────────────────────────────────
const PageHeader: React.FC = () => (
  <header className="relative border-b-2 border-[#F3EFE6]/20">
    <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-4 md:px-6 md:pt-10 md:pb-6">
      <nav className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        <Link href="/" className="shrink-0 hover:text-[#fb923c] transition-colors">
          Αρχική
        </Link>
        <span className="shrink-0">/</span>
        <span className="min-w-0 truncate text-[#F3EFE6]">Ανακοινώσεις</span>
      </nav>
    </div>
  </header>
);

// ───────────────────────────────────────────────────────────────────────
// Masthead — feed hero
// ───────────────────────────────────────────────────────────────────────
const Masthead: React.FC<{
  total: number;
  pinned: number;
  latest: Announcement | null;
}> = ({ total, pinned, latest }) => {
  const latestDate = latest ? latest.start_at ?? latest.created_at : null;
  return (
    <header className="relative overflow-hidden border-b-2 border-[#F3EFE6]/20">
      <div className="relative mx-auto max-w-[1400px] px-4 pt-8 pb-10 md:px-6 md:pt-14 md:pb-16">
        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-8"
          >
            <div className="mb-5 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]">
              <span className="h-[2px] w-8 bg-[#fb923c]" />
              <span className="text-[#fb923c]">Επίσημο Δελτίο</span>
              <span className="border border-[#F3EFE6]/20 px-2 py-0.5 text-[#F3EFE6]/70">
                EDITION · {pad2(total)}
              </span>
            </div>

            <h1
              className="font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(2rem, 8vw, 6rem)" }}
            >
              Ανακοινώσεις
            </h1>

            <div className="mt-6 flex items-center gap-4">
              <span className="h-[2px] w-12 bg-[#fb923c]" />
              <p className="font-[var(--f-body)] max-w-xl text-sm md:text-base text-[#F3EFE6]/70 leading-relaxed">
                Όλα τα επίσημα δελτία, αλλαγές προγράμματος και
                <span className="italic text-[#fb923c] font-semibold">
                  {" "}σημαντικές ειδοποιήσεις{" "}
                </span>
                της διοργάνωσης.
              </p>
            </div>
          </motion.div>

          {/* Right: counts panel */}
          <motion.aside
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
            className="col-span-12 md:col-span-4 flex flex-col gap-4"
          >
            <div
              className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] p-4 shadow-[6px_6px_0_0_#fb923c] md:p-5 md:shadow-[10px_10px_0_0_#fb923c]"
            >
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em]">
                <span className="text-[#fb923c]">Τελευταία Έκδοση</span>
                <span className="text-[#F3EFE6]/60">
                  {latestDate ? fmtFullDate(latestDate) : "—"}
                </span>
              </div>
              <p className="mt-4 font-[var(--f-display)] text-lg italic font-semibold leading-tight text-[#F3EFE6] line-clamp-2">
                {latest?.title ?? "Δεν υπάρχει πρόσφατο δελτίο"}
              </p>
              {latest && (
                <div className="mt-4 flex items-center gap-2 border-t border-[#F3EFE6]/15 pt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
                  <span>#{pad2(latest.id)}</span>
                  {latest.pinned && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="text-[#E8B931]">★ Καρφιτσωμένη</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 border-2 border-[#F3EFE6]/20 bg-[#0a0a14]">
              <div className="p-2.5 text-center md:p-3 border-r-2 border-[#F3EFE6]/20">
                <div className="font-[var(--f-brutal)] text-xl md:text-2xl text-[#F3EFE6]">
                  {pad2(total)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                  Σύνολο
                </div>
              </div>
              <div className="p-2.5 text-center md:p-3">
                <div className="font-[var(--f-brutal)] text-xl md:text-2xl text-[#E8B931]">
                  {pad2(pinned)}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/60">
                  Καρφιτσωμένες
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </header>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Filter tabs
// ───────────────────────────────────────────────────────────────────────
const FilterTabs: React.FC<{
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  counts: { all: number; pinned: number; recent: number };
}> = ({ filter, setFilter, counts }) => {
  const items: { k: FilterKey; label: string; c: number }[] = [
    { k: "all", label: "Όλες", c: counts.all },
    { k: "pinned", label: "Καρφιτσωμένες", c: counts.pinned },
    { k: "recent", label: "Τελευταίες 30Η", c: counts.recent },
  ];
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2 md:mb-10">
      {items.map((t) => {
        const active = filter === t.k;
        return (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            className={`flex items-center gap-2 border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] transition-all ${
              active
                ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70 hover:border-[#F3EFE6]/50 hover:text-[#F3EFE6]"
            }`}
          >
            <span>{t.label}</span>
            <span
              className={`font-[var(--f-brutal)] text-xs ${
                active ? "text-[#0a0a14]" : "text-[#F3EFE6]"
              }`}
            >
              {pad2(t.c)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Announcement card — broadsheet entry
// ───────────────────────────────────────────────────────────────────────
const AnnouncementCard: React.FC<{
  a: Announcement;
  index: number;
}> = ({ a, index }) => {
  const dateIso = a.start_at ?? a.created_at;
  const day = fmtDay(dateIso);
  const time = fmtTime(dateIso);
  const accent = a.pinned ? "#E8B931" : "#fb923c";
  const rotation = index % 2 === 0 ? "0.15deg" : "-0.15deg";

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.5 }}
      whileHover={{ y: -4 }}
      className="group relative"
    >
      <div
        className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[4px_4px_0_0_var(--s)] sm:shadow-[6px_6px_0_0_var(--s)] sm:[transform:rotate(var(--r))] transition-colors hover:border-[#F3EFE6]/40"
        style={
          {
            ["--s" as any]: accent,
            ["--r" as any]: rotation,
            backgroundImage: a.pinned
              ? "radial-gradient(circle at 20% 10%, rgba(232,185,49,0.10) 0%, transparent 55%)"
              : undefined,
          } as React.CSSProperties
        }
      >
        {/* Top strip */}
        <div className="flex items-stretch border-b-2 border-[#F3EFE6]/15">
          {/* Date pill */}
          <div
            className="flex shrink-0 flex-col items-center justify-center border-r-2 border-[#F3EFE6]/15 px-4 py-3"
            style={{ background: "#13131d" }}
          >
            <span
              className="font-[var(--f-brutal)] text-2xl leading-none"
              style={{ color: accent }}
            >
              {day.d}
            </span>
            <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
              {day.m}
            </span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
              <span className="text-[#F3EFE6]/70">#{pad2(a.id)}</span>
              <span className="opacity-50 text-[#F3EFE6]/40">·</span>
              <span style={{ color: accent }}>
                {a.pinned ? "★ Καρφιτσωμένη" : "Δελτίο"}
              </span>
              {time && (
                <>
                  <span className="opacity-50 text-[#F3EFE6]/40">·</span>
                  <span className="text-[#F3EFE6]/60">{time}</span>
                </>
              )}
            </div>
            <h2 className="font-[var(--f-display)] text-xl md:text-2xl font-black italic leading-tight text-[#F3EFE6]">
              {a.title}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 md:px-5 md:py-5">
          <div
            className="prose prose-sm prose-invert max-w-none font-[var(--f-body)]
              prose-headings:font-[var(--f-display)] prose-headings:italic prose-headings:text-[#F3EFE6]
              prose-p:text-[#F3EFE6]/80 prose-p:leading-relaxed
              prose-a:text-[#fb923c] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-[#F3EFE6]
              prose-code:text-[#E8B931]
              prose-pre:bg-[#13131d] prose-pre:border-2 prose-pre:border-[#F3EFE6]/15
              prose-ul:text-[#F3EFE6]/80 prose-ol:text-[#F3EFE6]/80
              prose-li:text-[#F3EFE6]/80
              prose-hr:border-[#F3EFE6]/15"
            dangerouslySetInnerHTML={renderBody(a)}
          />
        </div>

        {/* Footer rule */}
        <div className="flex items-center justify-between border-t border-[#F3EFE6]/10 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/45 md:px-5">
          <span>UltraChamp · Δελτίο Τύπου</span>
          <span>{fmtFullDate(dateIso)}</span>
        </div>
      </div>
    </motion.article>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Main client
// ───────────────────────────────────────────────────────────────────────
const AnnouncementsClient: React.FC = () => {
  const [rows, setRows] = useState<Announcement[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = async () => {
    if (nextOffset === null || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/announcements?active=1&offset=${nextOffset}&limit=${PAGE_SIZE}`,
        { cache: "no-store" }
      );
      const json = await r.json();
      if (json.error) throw new Error(json.error);
      setRows((prev) => prev.concat((json.data as Announcement[]) ?? []));
      setNextOffset(json.nextOffset ?? null);
      if (typeof json.total === "number") setTotal(json.total);
    } catch (err: any) {
      setError(err?.message ?? "Σφάλμα φόρτωσης");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rows.length === 0 && nextOffset === 0) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const pinned = rows.filter((a) => a.pinned).length;
    const thirty = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const recent = rows.filter(
      (a) => new Date(a.start_at ?? a.created_at).getTime() >= thirty
    ).length;
    return { all: total ?? rows.length, pinned, recent };
  }, [rows, total]);

  const filtered = useMemo(() => {
    if (filter === "pinned") return rows.filter((a) => a.pinned);
    if (filter === "recent") {
      const thirty = Date.now() - 1000 * 60 * 60 * 24 * 30;
      return rows.filter(
        (a) => new Date(a.start_at ?? a.created_at).getTime() >= thirty
      );
    }
    return rows;
  }, [rows, filter]);

  const latest = rows[0] ?? null;

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} min-h-screen overflow-x-hidden text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />

      <PageHeader />
      <Masthead
        total={total ?? rows.length}
        pinned={rows.filter((a) => a.pinned).length}
        latest={latest}
      />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6 md:py-16">
          <FilterTabs filter={filter} setFilter={setFilter} counts={counts} />

          {/* Empty / error / loading first-load states */}
          {rows.length === 0 && loading && (
            <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
              Φόρτωση…
            </div>
          )}

          {error && (
            <div className="mb-6 border-2 border-[#ef4444]/60 bg-[#1a0a0a] p-4 font-mono text-xs uppercase tracking-[0.22em] text-[#ef4444]">
              Σφάλμα · {error}
            </div>
          )}

          {rows.length > 0 && filtered.length === 0 && (
            <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
              Κανένα αποτέλεσμα για αυτό το φίλτρο
            </div>
          )}

          {rows.length === 0 && !loading && !error && (
            <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.2em] text-[#F3EFE6]/50">
              Δεν υπάρχουν ανακοινώσεις
            </div>
          )}

          {/* Feed */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:gap-7">
              {filtered.map((a, i) => (
                <AnnouncementCard key={a.id} a={a} index={i} />
              ))}
            </div>
          )}

          {/* Load more */}
          <div className="mt-10 flex items-center justify-center gap-3 md:mt-12">
            {nextOffset !== null && rows.length > 0 && (
              <button
                onClick={load}
                disabled={loading}
                className="group flex items-center gap-3 border-2 border-[#F3EFE6]/30 bg-[#13131d] px-5 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#F3EFE6] transition-all hover:border-[#fb923c] hover:text-[#fb923c] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="h-[2px] w-6 bg-[#fb923c] transition-all group-hover:w-10" />
                <span>{loading ? "Φόρτωση…" : "Φόρτωσε περισσότερα"}</span>
                <span className="font-[var(--f-brutal)] text-base leading-none text-[#fb923c]">
                  +
                </span>
              </button>
            )}
            {nextOffset === null && rows.length > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                — Τέλος δελτίου · {pad2(rows.length)} εγγραφές —
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Colophon */}
      <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-4 py-6 md:flex-row md:items-center md:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
            Ανακοινώσεις · έκδοση v2 (preview)
          </p>
          <Link
            href="/"
            className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
          >
            ← Αρχική
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default AnnouncementsClient;
