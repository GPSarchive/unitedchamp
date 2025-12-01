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
    <article className="group relative rounded-xl p-5
                       bg-black/40 backdrop-blur-sm
                       border border-white/10
                       shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_8px_16px_rgba(0,0,0,0.6)]
                       hover:bg-gradient-to-br hover:from-[#FFD700]/5 hover:to-transparent
                       hover:border-[#FFD700]/20
                       hover:shadow-[inset_0_1px_1px_rgba(255,215,0,0.08),0_12px_24px_rgba(0,0,0,0.8)]
                       transition-all duration-300">
      <div className="flex items-center gap-3 mb-3">
        {a.pinned && (
          <span className="text-xs px-2.5 py-1 rounded-md
                         bg-[#FFD700]/10 border border-[#FFD700]/30
                         text-[#FFD700] font-medium tracking-wide">
            📌 Καρφιτσωμένο
          </span>
        )}
        <h3 className="font-semibold text-lg text-white/95 group-hover:text-white transition-colors">
          {a.title}
        </h3>
        <span className="ml-auto text-xs text-white/40 group-hover:text-white/60 transition-colors">
          {displayDate}
        </span>
      </div>

      <div
        className="prose prose-sm prose-invert max-w-none
                   prose-headings:text-white/90 prose-headings:font-semibold
                   prose-p:text-white/75 prose-p:leading-relaxed
                   prose-a:text-[#FFD700] prose-a:no-underline hover:prose-a:underline
                   prose-strong:text-white/90 prose-strong:font-semibold
                   prose-ul:text-white/75 prose-ol:text-white/75
                   prose-li:text-white/75
                   prose-code:text-[#FFD700] prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                   prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10"
        dangerouslySetInnerHTML={renderBody(a)}
      />
    </article>
  );
}
