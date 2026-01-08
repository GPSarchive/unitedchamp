// Utility functions for articles

/**
 * Calculate estimated reading time for article content
 * @param content TipTap JSON content
 * @returns Estimated reading time in minutes
 */
export function calculateReadTime(content: any): number {
  if (!content) return 0;

  // Extract text from TipTap JSON
  const extractText = (node: any): string => {
    if (!node) return '';

    let text = '';

    // If node has text property, add it
    if (node.text) {
      text += node.text;
    }

    // If node has content array, recursively extract text from children
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        text += ' ' + extractText(child);
      }
    }

    return text;
  };

  const text = extractText(content);
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length;

  // Average reading speed: 200 words per minute
  const readTimeMinutes = Math.ceil(wordCount / 200);

  return readTimeMinutes;
}

/**
 * Format view count for display
 * @param count Number of views
 * @returns Formatted string (e.g., "1.2K views", "523 views")
 */
export function formatViewCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K views`;
  }
  return `${count} views`;
}

/**
 * Format read time for display
 * @param minutes Number of minutes
 * @returns Formatted string (e.g., "5 min read")
 */
export function formatReadTime(minutes: number): string {
  if (minutes < 1) return '< 1 min read';
  return `${minutes} min read`;
}
