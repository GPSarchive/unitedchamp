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
    <article className="rounded-xl border bg-white p-4">
      <div className="flex items-center gap-2">
        {a.pinned && (
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200">
            Pinned
          </span>
        )}
        <h3 className="font-semibold">{a.title}</h3>
        <span className="ml-auto text-xs text-gray-500">{displayDate}</span>
      </div>

      <div
        className="prose prose-sm mt-2"
        dangerouslySetInnerHTML={renderBody(a)}
      />
    </article>
  );
}
