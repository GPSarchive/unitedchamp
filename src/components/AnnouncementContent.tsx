'use client';

import DOMPurify from 'dompurify';
import { marked } from 'marked';

interface AnnouncementContentProps {
  body: string | null;
  format: 'md' | 'html' | 'plain' | null | undefined;
}

export default function AnnouncementContent({ body, format }: AnnouncementContentProps) {
  // Handle null/undefined body
  const safeBody = body ?? '';

  // Default to 'plain' if format is null/undefined
  const safeFormat = format ?? 'plain';

  // Generate HTML based on format
  let contentHTML = '';

  if (safeFormat === 'html') {
    contentHTML = DOMPurify.sanitize(safeBody, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'target', 'rel', 'name'],
    });
  } else if (safeFormat === 'md') {
    const html = marked.parse(safeBody, { async: false }) as string;
    contentHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'width', 'height', 'target', 'rel', 'name'],
    });
  } else {
    // plain text - just replace newlines with <br/>
    contentHTML = safeBody.replace(/\n/g, '<br/>');
  }

  return (
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
  );
}
