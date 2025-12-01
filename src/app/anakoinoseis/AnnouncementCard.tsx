// components/announcements/AnnouncementCard.tsx
"use client";
import * as React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export type Announcement = {
  id: number;
  title: string;
  body: string;
  format: "md" | "html" | "plain";
  start_at: string | null;
  created_at: string;
  pinned: boolean;
};

const tz = "Europe/Athens";

// Ensure marked runs synchronously (so parse returns string, not Promise)
marked.setOptions({ gfm: true, breaks: true, async: false });

function fmtDate(d: string | null) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleString("el-GR", {
    timeZone: tz,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function renderBody(a: Announcement) {
  if (a.format === "html") {
    return { __html: DOMPurify.sanitize(a.body) };
  }
  if (a.format === "md") {
    // Explicitly pass async: false to narrow the return type to string
    const html = marked.parse(a.body, { async: false }) as string;
    return { __html: DOMPurify.sanitize(html) };
  }
  // plain
  return { __html: a.body.replace(/\n/g, "<br/>") };
}

export default function AnnouncementCard({ a }: { a: Announcement }) {
  const displayDate = fmtDate(a.start_at || a.created_at);

  return (
    <article className="group p-6 rounded-2xl bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40 transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        {a.pinned && (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-200/15 border border-amber-200/30 text-amber-100 font-medium tracking-wide uppercase">
            Pinned
          </span>
        )}
        <span className="ml-auto text-xs text-white/60">{displayDate}</span>
      </div>

      <h3 className="font-semibold text-xl text-white mb-4 group-hover:text-white/95 transition-colors">{a.title}</h3>

      <div
        className="prose prose-sm prose-invert max-w-none
          prose-headings:text-white/90 prose-p:text-white/75
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white/90 prose-code:text-emerald-300
          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/20
          prose-ul:text-white/75 prose-ol:text-white/75
          prose-li:text-white/75"
        dangerouslySetInnerHTML={renderBody(a)}
      />
    </article>
  );
}
