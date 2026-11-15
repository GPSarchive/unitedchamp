// Renders an announcement body on the SERVER (used by /announcement/[id]).
//
// It used DOMPurify, which needs a browser window: during server rendering
// `DOMPurify.sanitize` does not exist, so every html/md announcement page
// crashed with "sanitize is not a function" (500). sanitize-html is plain JS
// and works on the server.
import sanitizeHtml from 'sanitize-html';
import { marked } from 'marked';

interface AnnouncementContentProps {
  body: string | null;
  format: 'md' | 'html' | 'plain' | null | undefined;
}

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
  ],
  allowedAttributes: {
    '*': ['href', 'src', 'alt', 'title', 'width', 'height', 'target', 'rel', 'name'],
  },
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default function AnnouncementContent({ body, format }: AnnouncementContentProps) {
  const safeBody = body ?? '';
  const safeFormat = format ?? 'plain';

  let contentHTML: string;
  if (safeFormat === 'html') {
    contentHTML = sanitizeHtml(safeBody, SANITIZE);
  } else if (safeFormat === 'md') {
    contentHTML = sanitizeHtml(marked.parse(safeBody, { async: false }) as string, SANITIZE);
  } else {
    // plain text: escape it, then keep the line breaks
    contentHTML = escapeHtml(safeBody).replace(/\n/g, '<br/>');
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
