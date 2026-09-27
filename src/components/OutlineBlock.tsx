import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { OutlineNode, visibleOutlineNodes } from '../utils/scriptOutline';

export const OutlineBlock = React.memo(({ nodes, label }: { nodes: OutlineNode[]; label?: string }) => {
  const [folded, setFolded] = useState<Set<string>>(new Set());
  const visible = useMemo(() => visibleOutlineNodes(nodes, folded), [nodes, folded]);
  const parents = useMemo(() => new Set(nodes.filter((node, index) => nodes[index + 1]?.depth > node.depth).map(node => node.id)), [nodes]);
  return <div className="space-y-1 font-sans">
    {label && <div className="mb-3 text-xs text-white/60">{label}</div>}
    {visible.map(node => <div key={node.id} className="flex items-start gap-1" style={{ paddingLeft: node.depth * 16 }}>
      <button type="button" aria-label={folded.has(node.id) ? '展開: ' + node.text : '折り畳む: ' + node.text}
        aria-expanded={!folded.has(node.id)} className={`outline-toggle shrink-0 min-w-11 min-h-11 flex items-center justify-center ${parents.has(node.id) ? 'text-white/75' : 'invisible'}`}
        onClick={() => setFolded(previous => { const next = new Set(previous); if (next.has(node.id)) next.delete(node.id); else next.add(node.id); return next; })}>
        {folded.has(node.id) ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
      </button>
      <div className="script-text-dynamic flex-1 min-w-0 py-2 px-3 rounded border border-white/5 bg-white/[0.02] text-white">{node.text}</div>
    </div>)}
  </div>;
});
