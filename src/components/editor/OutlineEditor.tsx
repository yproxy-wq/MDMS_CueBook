
import React, { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';

interface OutlineEditorProps {
  initialContent: string;
  onChange: (md: string) => void;
}

export const OutlineEditor: React.FC<OutlineEditorProps> = ({ initialContent, onChange }) => {
  const parseMarkdownToOutline = useCallback((markdown: string) => {
    const lines = (markdown || '').split('\n');
    const result: { id: string; text: string; depth: number }[] = [];
    lines.forEach((line, i) => {
      if (!line.trim() && lines.length > 1) return;
      
      const expandedLine = line.replace(/\t/g, '  ');
      const match = expandedLine.match(/^(\s*)(?:[-*+>]|\d+\.)?\s*(.*)/);
      
      if (match) {
        const leadingSpaces = match[1].length;
        const depth = Math.floor(leadingSpaces / 2);
        const text = match[2].trim();
        result.push({ 
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`, 
          text, 
          depth 
        });
      } else if (line.trim()) {
        result.push({ 
          id: `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`, 
          text: line.trim(), 
          depth: 0 
        });
      }
    });
    return result.length === 0 ? [{ id: `init-${Date.now()}`, text: '', depth: 0 }] : result;
  }, []);

  const [items, setItems] = useState(() => parseMarkdownToOutline(initialContent));
  const [prevInitialContent, setPrevInitialContent] = useState(initialContent);
  const [lastEmittedMd, setLastEmittedMd] = useState(initialContent);
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const syncToParent = useCallback((currentItems: typeof items) => {
    const md = currentItems.map((it) => `${'  '.repeat(it.depth)}- ${it.text}`).join('\n');
    if (md !== lastEmittedMd) {
      setLastEmittedMd(md);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onChange(md);
      }, 500);
    }
  }, [onChange, lastEmittedMd]);

  if (initialContent !== prevInitialContent) {
    setPrevInitialContent(initialContent);
    if (initialContent !== lastEmittedMd) {
      setItems(parseMarkdownToOutline(initialContent));
      setLastEmittedMd(initialContent);
    }
  }

  const handlePaste = (e: React.ClipboardEvent, idx: number) => {
    const pasteData = e.clipboardData.getData('text');
    if (pasteData.includes('\n')) {
      e.preventDefault();
      const newItems = parseMarkdownToOutline(pasteData);
      const next = [...items];
      next.splice(idx, 1, ...newItems);
      setItems(next);
      syncToParent(next);
    }
  };

  return (
    <div className="flex flex-col gap-0.5 p-2 bg-[#0a0a0a] rounded-xl border border-white/10 min-h-[150px]">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2 group/line" style={{ paddingLeft: `${item.depth * 18}px` }}>
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover/line:bg-white/40 transition-colors" />
          <input 
            value={item.text || ''}
            onChange={(e) => {
              const next = [...items];
              next[idx] = { ...next[idx], text: e.target.value };
              setItems(next);
              syncToParent(next);
            }}
            onPaste={(e) => handlePaste(e, idx)}
            onKeyDown={(e) => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const next = [...items];
                if (e.shiftKey) {
                  next[idx] = { ...next[idx], depth: Math.max(0, next[idx].depth - 1) };
                } else {
                  next[idx] = { ...next[idx], depth: next[idx].depth + 1 };
                }
                setItems(next);
                syncToParent(next);
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const next = [...items];
                next.splice(idx + 1, 0, { id: `item-${Date.now()}`, text: '', depth: item.depth });
                setItems(next);
                syncToParent(next);
              } else if (e.key === 'Backspace' && item.text === '' && items.length > 1) {
                e.preventDefault();
                const next = [...items];
                next.splice(idx, 1);
                setItems(next);
                syncToParent(next);
              }
            }}
            placeholder="内容を入力..."
            className="w-full bg-transparent border-none outline-none text-[13px] text-white/90 placeholder-white/5 py-0.5 font-sans"
          />
        </div>
      ))}
      <button 
        onClick={() => {
          const next = [...items, { id: `item-${Date.now()}`, text: '', depth: 0 }];
          setItems(next);
          syncToParent(next);
        }}
        className="mt-2 text-[10px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1 px-1"
      >
        <Plus size={12}/> 行を追加
      </button>
    </div>
  );
};
