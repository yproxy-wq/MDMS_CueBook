export interface OutlineNode { id: string; text: string; depth: number }

export function parseOutlineNodes(text: string): OutlineNode[] {
  return text.split('\n').flatMap((line, index) => {
    const item = line.match(/^(\s*)-\s+(.*)/);
    const heading = line.match(/^(#{1,3})\s+(.*)/);
    const value = item?.[2] ?? heading?.[2] ?? line.trim();
    return value ? [{ id: String(index), text: value, depth: item ? Math.floor(item[1].length / 2) : heading ? heading[1].length - 1 : 0 }] : [];
  });
}

/** A closed branch ends at its next sibling or ancestor. Linear in node count. */
export function visibleOutlineNodes(nodes: OutlineNode[], folded: ReadonlySet<string>): OutlineNode[] {
  let hiddenBelow: number | null = null;
  return nodes.filter(node => {
    if (hiddenBelow !== null && node.depth > hiddenBelow) return false;
    hiddenBelow = folded.has(node.id) ? node.depth : null;
    return true;
  });
}
