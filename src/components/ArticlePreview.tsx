'use client';

import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import DOMPurify from 'dompurify';

interface ArticlePreviewProps {
  content: any;
  title?: string;
  className?: string;
}

export default function ArticlePreview({ content, title, className = '' }: ArticlePreviewProps) {
  // Generate HTML from TipTap JSON
  const html = content
    ? generateHTML(content, [
        StarterKit,
        Underline,
        Image.configure({
          HTMLAttributes: {
            class: 'max-w-full h-auto rounded-lg my-4',
          },
        }),
      ])
    : '';

  // Sanitize HTML for security
  const sanitizedHTML = typeof window !== 'undefined' ? DOMPurify.sanitize(html) : html;

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      {title && <h1 className="text-3xl font-bold text-white mb-6">{title}</h1>}
      <div
        className="article-content text-white/90 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      />
    </div>
  );
}
