/** Collapse line breaks only inside balanced outer details; nested/sibling boundaries remain intact. */
export function preprocessMarkdownForDetails(markdown: string): string {
  const tag = /<\/?details\b[^>]*>/gi;
  const ranges: [number, number][] = [];
  let depth = 0, start = 0;
  for (const match of markdown.matchAll(tag)) {
    if (/^<\//.test(match[0])) {
      if (depth > 0 && --depth === 0) ranges.push([start, match.index! + match[0].length]);
    } else {
      if (depth++ === 0) start = match.index!;
    }
  }
  let output = '', cursor = 0;
  for (const [from, to] of ranges) {
    output += markdown.slice(cursor, from);
    output += markdown.slice(from, to).replace(/(\r?\n\s*){2,}/g, '<br><br>').replace(/\r?\n/g, '<br>');
    cursor = to;
  }
  return output + markdown.slice(cursor);
}
