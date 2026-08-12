
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Phase, Scenario, Character, ScriptBlock } from '../types';
import { CheckSquare, Users, UserCircle, Plus, Minus, Check, ChevronRight, ChevronDown, ChevronUp, BookOpen, FileText, ExternalLink, Share, Edit3, Trash2, X } from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import { QuickNote } from './QuickNote';

interface ScriptViewerProps {
  phase: Phase;
  scenario: Scenario;
  scenarioTitle?: string;
  characters: Character[];
  onUpdateCharacter?: (charId: string, updates: Partial<Character>) => void;
  onToggleChecklist?: (phaseId: string, index: number) => void;
  activeTab?: 'guide' | 'characters';
  onTabChange?: (tab: 'guide' | 'characters') => void;
  onOpenHandout?: (charId: string) => void;
  onShowImage?: (imageId: string | null) => void;
  activeImageId?: string | null;
  isPreviewing?: boolean;
  pdfPageStates?: Record<string, number>;
  onSetPdfPageState?: (id: string, page: number) => void;
  onOpenSync?: () => void;
  onUpdateScenario?: (updates: Partial<Scenario>) => void;
}

const FLAG_COLORS = ['#3b82f6', '#ef4444', '#facc15'];

const ImageBlock: React.FC<{ 
  content: string; 
  label?: string;
  onOpenSync?: () => void;
}> = React.memo(({ content, label, onOpenSync }) => {
  return (
    <div className="w-full bg-black/40 rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl relative z-10 group/img">
      <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold font-cinzel text-white/40">
           <span>{label ? label.toUpperCase() : 'IMAGE REFERENCE'}</span>
        </div>
        {onOpenSync && (
          <button 
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-500 hover:bg-sky-500/20 transition-all text-[9px] font-black font-cinzel tracking-widest"
          >
            <Share size={10} />
            <span>SYNC</span>
          </button>
        )}
      </div>
      <div className="p-4 flex items-center justify-center bg-[#1a1a1a]">
        {content ? (
          <img 
            src={content} 
            className="max-w-full h-auto rounded shadow-lg transition-transform duration-500 group-hover/img:scale-[1.01]" 
            alt={label || "Reference Image"} 
            referrerPolicy="no-referrer" 
          />
        ) : (
          <div className="text-white/10 italic text-[10px]">No image content</div>
        )}
      </div>
    </div>
  );
});
ImageBlock.displayName = 'ImageBlock';

const PdfBlock: React.FC<{ 
  content: string; 
  label?: string;
  page?: number;
  onPageChange?: (page: number) => void;
  onOpenSync?: () => void;
}> = React.memo(({ content, label, page = 1, onPageChange, onOpenSync }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (content.startsWith('data:application/pdf;base64,')) {
      try {
        const base64 = content.split(',')[1];
        const paddedBase64 = base64.replace(/\s/g, '').padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
        const binary = atob(paddedBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Use a clean microtask to avoid "cascading renders" lint warning
        Promise.resolve().then(() => {
          setBlobUrl(url);
          setIsLoading(false);
        });
        
        return () => URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Failed to create Blob URL for PDF', e);
        Promise.resolve().then(() => {
          setIsLoading(false);
        });
      }
    } else {
      Promise.resolve().then(() => {
        setBlobUrl(null);
        setIsLoading(true);
      });
    }
  }, [content]);

  const isDataUri = content.startsWith('data:');
  const displayUrl = blobUrl || (!isDataUri ? content : null);
  
  const fullUrl = useMemo(() => {
    if (!displayUrl) return null;
    if (isDataUri) return `${displayUrl}#navpanes=0&view=Fit&zoom=page-fit&page=${page}`;
    
    // Dropbox etc
    return `https://docs.google.com/viewer?url=${encodeURIComponent(displayUrl)}&embedded=true&page=${page}&zoom=page-fit`;
  }, [displayUrl, page, isDataUri]);

  return (
    <div className="w-full min-h-[400px] h-[600px] md:h-[850px] bg-black/40 rounded-xl border border-white/10 overflow-hidden flex flex-col group/pdf shadow-2xl relative z-10">
      <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold font-cinzel text-white/40">
            <FileText size={12} />
            <span>{label ? label.toUpperCase() : (isDataUri ? 'LOCAL PDF' : 'REMOTE PDF')}</span>
          </div>
          
          {/* Page Memory Control */}
          <div className="flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/5">
            <span className="text-[8px] font-bold text-white/20 uppercase mr-1">Page</span>
            <button 
              onClick={() => onPageChange?.(Math.max(1, page - 1))}
              className="text-white/30 hover:text-white transition-colors"
            >
              <Minus size={10} />
            </button>
            <input 
              type="text" 
              value={page}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) onPageChange?.(val);
              }}
              className="w-6 bg-transparent text-center text-[10px] font-mono font-bold text-sky-500 focus:outline-none"
            />
            <button 
              onClick={() => onPageChange?.(page + 1)}
              className="text-white/30 hover:text-white transition-colors"
            >
              <Plus size={10} />
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onOpenSync && (
            <button 
              onClick={onOpenSync}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-500 hover:bg-sky-500/20 transition-all text-[9px] font-black font-cinzel tracking-widest"
            >
              <Share size={10} />
              <span>SYNC</span>
            </button>
          )}

          {fullUrl && (
            <a 
              href={fullUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-bold text-white/20 hover:text-white transition-all bg-white/5 px-2 py-1 rounded"
            >
              <ExternalLink size={12} />
              <span>OPEN TAB</span>
            </a>
          )}
        </div>
      </div>
      <div className="flex-1 bg-[#1a1a1a] relative">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/20 font-cinzel tracking-widest bg-black/40 backdrop-blur-sm z-20">
             <div className="w-8 h-8 border-2 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
             <span>LOADING PDF...</span>
          </div>
        )}
        
        {!fullUrl && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center text-red-500/40 font-cinzel tracking-widest bg-black/40">
             <div className="p-4 rounded-full bg-red-500/5 border border-red-500/10">
               <FileText size={48} strokeWidth={1} />
             </div>
             <div className="space-y-2">
               <span className="block text-sm font-bold">PDF NOT ACCESSIBLE</span>
               <p className="text-[9px] normal-case tracking-normal opacity-50 max-w-xs mx-auto">
                 URLが正しいか、またはローカルにアップロードされた有効なPDFデータであることを確認してください。
                 Dropboxの場合は、「メディアリソース」タブで正規化されている必要があります。
               </p>
             </div>
          </div>
        )}

        {fullUrl && (
          <iframe 
            src={fullUrl} 
            className="absolute inset-0 w-full h-full border-none"
            title="PDF Viewer"
            onLoad={() => setIsLoading(false)}
          />
        )}
      </div>
    </div>
  );
});
PdfBlock.displayName = 'PdfBlock';

interface OutlineNode {
  id: string;
  text: string;
  depth: number;
}

type ProcessedBlock = ScriptBlock & { 
  html?: string; 
  nodes?: OutlineNode[];
  stableKey?: string;
};

// Sub-component for individual blocks to optimize with React.memo
const ScriptBlockItem: React.FC<{ 
  block: ProcessedBlock, 
  renderBlock: (block: ProcessedBlock) => React.ReactNode 
}> = React.memo(({ block, renderBlock }) => {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {renderBlock(block)}
    </div>
  );
});

const ScriptViewer: React.FC<ScriptViewerProps> = React.memo(({ 
  phase, 
  scenario, 
  scenarioTitle,
  characters, 
  onUpdateCharacter, 
  onToggleChecklist, 
  activeTab = 'guide',
  onTabChange,
  onOpenHandout,
  onShowImage,
  activeImageId,
  isPreviewing,
  pdfPageStates,
  onSetPdfPageState,
  onOpenSync,
  onUpdateScenario
}) => {
  const [foldedNodes, setFoldedNodes] = useState<Set<string>>(new Set());
  const [isChecklistFolded, setIsChecklistFolded] = useState(false);
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editingChecklists, setEditingChecklists] = useState<string[]>([]);
  const scriptContentRef = useRef<HTMLDivElement>(null);

  // Swipe Gestures for Mobile and Tablet Layout integration
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    // Prevent tab swipe if touch started inside table or scrollable block
    if (target && (target.closest('table') || target.closest('.overflow-x-auto') || target.closest('input') || target.closest('textarea'))) {
      touchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const diffX = t.clientX - touchStartRef.current.x;
    const diffY = t.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Strict horizontal swipe with offset threshold
    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      if (diffX > 0) {
        if (activeTab === 'characters') {
          onTabChange?.('guide');
        }
      } else {
        if (activeTab === 'guide') {
          onTabChange?.('characters');
        } else if (activeTab === 'characters') {
          onTabChange?.('guide');
        }
      }
    }
  }, [activeTab, onTabChange]);

  // Performance: For very long scripts, we might want to limit visible blocks or use deferred rendering
  const [visibleCount, setVisibleCount] = useState(15); 
  const prevPhaseIdRef = useRef(phase.id);
  const prevPdfFingerprintRef = useRef<string>('');

  // Fingerprint of all PDFs in the current phase to detect if we can persist the view
  const pdfFingerprint = useMemo(() => {
    return (phase.scriptBlocks || [])
      .filter(b => b.type === 'pdf')
      .map(b => b.content)
      .sort()
      .join('|');
  }, [phase.scriptBlocks]);

  useEffect(() => {
    if (phase.id !== prevPhaseIdRef.current) {
      const isPersistentPdf = pdfFingerprint && pdfFingerprint === prevPdfFingerprintRef.current;
      
      // Only reset visible count and scroll if the PDF set has changed.
      // Keeping the scroll position and visible count helps keep the iframe mounted and scroll-stable.
      if (!isPersistentPdf) {
        setVisibleCount(15);
        if (scriptContentRef.current) {
          scriptContentRef.current.scrollTop = 0;
        }
      }
      
      prevPhaseIdRef.current = phase.id;
      prevPdfFingerprintRef.current = pdfFingerprint;
    }
  }, [phase.id, pdfFingerprint]);
  
  useEffect(() => {
    const blocks = phase.scriptBlocks || [];
    const totalBlocks = blocks.length;
    
    // If we already have more blocks visible than total, no need to reset or wait
    if (visibleCount >= totalBlocks) return;

    const interval = setInterval(() => {
        setVisibleCount(prev => {
          if (prev >= totalBlocks) {
            clearInterval(interval);
            return prev;
          }
          return prev + 15;
        });
      }, 30);
      return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.id, (phase.scriptBlocks || []).length]); 

  const updateTokens = useCallback((charId: string, delta: number) => {
    const char = characters.find(c => c.id === charId);
    if (char && onUpdateCharacter) {
      onUpdateCharacter(charId, { tokens: Math.max(0, char.tokens + delta) });
    }
  }, [characters, onUpdateCharacter]);

  const toggleFlag = useCallback((charId: string, index: number) => {
    const char = characters.find(charItem => charItem.id === charId);
    if (char && onUpdateCharacter) {
      const newFlags = [...char.flags];
      newFlags[index] = !newFlags[index];
      onUpdateCharacter(charId, { flags: newFlags });
    }
  }, [characters, onUpdateCharacter]);

  const toggleFold = useCallback((id: string) => {
    setFoldedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const parseOutline = useCallback((text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const match = line.match(/^(\s*)-\s+(.*)/);
      if (match) {
        return { id: `item-${i}`, text: match[2], depth: Math.floor(match[1].length / 2) };
      }
      const headerMatch = line.match(/^(#{1,3})\s+(.*)/);
      if (headerMatch) {
        return { id: `item-${i}`, text: headerMatch[2], depth: headerMatch[1].length - 1 };
      }
      const trimmed = line.trim();
      return trimmed ? { id: `item-${i}`, text: trimmed, depth: 0 } : null;
    }).filter(Boolean) as { id: string, text: string, depth: number }[];
  }, []);

  const isNodeHidden = useCallback((nodes: { id: string, text: string, depth: number }[], idx: number) => {
    for (let i = idx - 1; i >= 0; i--) {
      if (nodes[i].depth < nodes[idx].depth && foldedNodes.has(nodes[i].id)) return true;
    }
    return false;
  }, [foldedNodes]);

  const checklistPos = scenario.checklistPosition || 'bottom';

  const renderChecklist = (posLabel: string) => (
    <div 
      key={posLabel} 
      className={`shrink-0 bg-black/60 border-white/5 transition-all duration-300 relative z-[100] ${posLabel === 'top' ? 'border-b' : 'border-t'}`}
    >
      {isPreviewing && posLabel === 'top' && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-sky-500/50 shadow-[0_0_10px_rgba(14,165,233,0.3)] z-50" />
      )}
      <button 
        onClick={() => setIsChecklistFolded(!isChecklistFolded)}
        className={`absolute left-1/2 -translate-x-1/2 w-12 h-6 bg-black/80 border border-white/30 rounded-full flex items-center justify-center transition-all z-[60] shadow-2xl backdrop-blur-md hover:border-white/60 group
          ${posLabel === 'top' ? '-bottom-3' : '-top-3'}
        `}
      >
        {isChecklistFolded 
          ? (posLabel === 'top' ? <ChevronDown size={14} style={{ color: scenario.themeColor }} /> : <ChevronUp size={14} style={{ color: scenario.themeColor }} />)
          : (posLabel === 'top' ? <ChevronUp size={14} style={{ color: scenario.themeColor }} /> : <ChevronDown size={14} style={{ color: scenario.themeColor }} />)
        }
      </button>

      {!isPreviewing && (
        <QuickNote
          scenarioId={scenario.id}
          themeColor={scenario.themeColor}
          position="absolute"
          posLabel={posLabel as 'top' | 'bottom'}
        />
      )}

      <div className={`w-full overflow-hidden flex flex-col transition-all duration-300 ${isChecklistFolded ? 'h-12' : 'max-h-[30vh]'}`}>
        <div className="w-full flex items-center px-4 py-3 text-white/75 shrink-0 justify-between">
          <div className="flex items-center gap-2 uppercase tracking-widest text-[9px] font-bold font-cinzel">
            <CheckSquare size={12} />
            <span>CHECKLIST ({posLabel})</span>
            {!isPreviewing && onUpdateScenario && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingChecklists([...(phase.checklists || [])]);
                  setIsEditingChecklist(true);
                }}
                className="ml-2 text-white/40 hover:text-white transition-all duration-200 cursor-pointer p-1 rounded hover:bg-white/5 flex items-center justify-center shrink-0"
                title="チェックリストを編集"
              >
                <Edit3 size={11} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPreviewing && !isChecklistFolded && (
               <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-500 scale-90">
                  <BookOpen size={10} />
                  <span className="text-[8px] font-black font-cinzel uppercase tracking-widest">Preview Mode - Read Only</span>
               </div>
            )}
          </div>
        </div>
        
        {!isChecklistFolded && (
          <div className="p-4 pt-0 space-y-1.5 flex flex-col overflow-y-auto scrollbar-thin flex-1">
            {phase.checklists.map((item, i) => (
              <label key={i} className={`flex items-center gap-3 p-2 rounded-lg border transition-all group ${isPreviewing ? 'opacity-55 cursor-default border-white/10 bg-white/[0.01]' : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/10 cursor-pointer'}`}>
                <input 
                  type="checkbox" 
                  checked={phase.checklistResults?.[i] || false}
                  disabled={isPreviewing}
                  onChange={() => onToggleChecklist && onToggleChecklist(phase.id, i)}
                  className="w-4 h-4 rounded border-white/20 bg-transparent text-red-700 focus:ring-0 cursor-pointer disabled:cursor-default shrink-0" 
                />
                <span className={`text-[11px] transition-colors leading-relaxed break-words ${phase.checklistResults?.[i] ? 'text-white/45 line-through' : 'text-white/95 group-hover:text-white'}`}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Handle image sync buttons in markdown
  useEffect(() => {
    if (activeTab !== 'guide') return;
    
    const container = scriptContentRef.current;
    if (!container) return;

    const handleImageClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const btn = target.closest('.image-sync-btn');
      if (btn) {
        const imageId = btn.getAttribute('data-img-id');
        if (imageId && onShowImage) {
          // Toggle if already active
          onShowImage(activeImageId === imageId ? null : imageId);
        }
      }
    };

    container.addEventListener('click', handleImageClick);
    return () => container.removeEventListener('click', handleImageClick);
  }, [activeTab, onShowImage, activeImageId, visibleCount, phase.id]);

  const processScriptHtml = useCallback((html: string) => {
    let result = html;
    
    // Support custom Markdown-like and XML-like color tags:
    // 1. [text](color:red) / [text](color:#ff0000)
    result = result.replace(/\[([^\]]+)\]\(color:\s*([^)]+)\)/g, '<span style="color: $2">$1</span>');
    
    // 2. {color:red}(text) / {color:#ff0000}(text)
    result = result.replace(/\{color:\s*([^}]+)\}\(([^)]+)\)/g, '<span style="color: $1">$2</span>');

    // 3. <color:red>text</color> / <color: #ff0000>text</color>
    result = result.replace(/&lt;color:\s*([^&]+)&gt;([\s\S]*?)&lt;\/color&gt;/g, '<span style="color: $1">$2</span>');
    result = result.replace(/<color:\s*([^>]+)>([\s\S]*?)<\/color>/g, '<span style="color: $1">$2</span>');

    // 4. <color=red>text</color> / <color=#ff0000>text</color>
    result = result.replace(/&lt;color=\s*([^&]+)&gt;([\s\S]*?)&lt;\/color&gt;/g, '<span style="color: $1">$2</span>');
    result = result.replace(/<color=\s*([^>]+)>([\s\S]*?)<\/color>/g, '<span style="color: $1">$2</span>');

    // Replace [[ID]] with a button
    // The regex matches [[AnythingNotInBrackets]]
    return result.replace(/\[\[([^\]]+)\]\]/g, (match, id) => {
      const isActive = activeImageId === id;
      // Brutalist elegant button style
      return `<button 
        class="image-sync-btn px-2 py-0.5 mx-1 rounded border transition-all duration-300 font-mono text-[10px] font-bold cursor-pointer inline-flex items-center gap-1.5
          ${isActive 
            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/80 hover:border-white/30 hover:bg-white/10'}
        " 
        data-img-id="${id}"
        title="Sync Image: ${id}"
      >
        <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-white/20'}"></span>
        ${id}
      </button>`;
    });
  }, [activeImageId]);

  const processedHtmlMap = useRef<Record<string, { raw: string, html: string }>>({});

  const memoizedBlocks = useMemo(() => {
    const pdfContentCounts: Record<string, number> = {};

    return (phase.scriptBlocks || []).map(block => {
      let stableKey = block.id;

      if (block.type === 'pdf') {
        const content = block.content;
        pdfContentCounts[content] = (pdfContentCounts[content] || 0) + 1;
        // Use content-based key for PDFs to persist across phases, 
        // but include index-like suffix if multiple identical PDFs exist in one phase
        stableKey = `pdf-${content.slice(0, 100)}-${pdfContentCounts[content]}`;
      }

      if (block.type === 'markdown') {
        const cache = processedHtmlMap.current[block.id];
        let baseHtml = '';
        if (cache && cache.raw === block.content) {
          baseHtml = cache.html;
        } else {
          baseHtml = renderMarkdown(block.content);
          processedHtmlMap.current[block.id] = { raw: block.content, html: baseHtml };
        }

        return {
          ...block,
          stableKey,
          html: processScriptHtml(baseHtml)
        };
      } else if (block.type === 'outline') {
        return {
          ...block,
          stableKey,
          nodes: parseOutline(block.content)
        };
      } else {
        return {
          ...block,
          stableKey
        };
      }
    });
  }, [phase.scriptBlocks, parseOutline, processScriptHtml]);

  const renderBlock = useCallback((block: ProcessedBlock) => {
    switch (block.type) {
      case 'markdown':
        return (
          <div className="prose prose-invert prose-red max-w-none prose-headings:mt-0 first:prose-p:mt-0">
            {block.label && (
              <div className="mb-2 text-[10px] font-bold font-cinzel text-white/50 uppercase tracking-widest">
                {block.label}
              </div>
            )}
            <div 
              className="markdown-content font-sans text-white/90 leading-relaxed text-[13px] md:text-[14px] bg-white/[0.02] p-5 md:p-6 md:pt-4 rounded-xl border border-white/5 shadow-inner script-text-dynamic"
              dangerouslySetInnerHTML={{ __html: block.html || '' }}
            />
          </div>
        );
      case 'outline': {
        const nodes = block.nodes || [];
        return (
          <div className="space-y-1 font-sans">
            {block.label && (
              <div className="mb-4 text-[10px] font-bold font-cinzel text-white/50 uppercase tracking-widest">
                {block.label}
              </div>
            )}
            {nodes.map((node, idx) => {
              if (isNodeHidden(nodes, idx)) return null;
              const hasChildren = nodes[idx + 1] && nodes[idx + 1].depth > node.depth;
              const isFolded = foldedNodes.has(node.id);
              return (
                <div 
                  key={node.id} 
                  className="flex items-start gap-2 group/node"
                  style={{ paddingLeft: `${node.depth * 20}px` }}
                >
                  <button 
                    onClick={() => toggleFold(node.id)}
                    className={`mt-1 w-4 h-4 flex items-center justify-center transition-all ${hasChildren ? 'text-white/65 hover:text-white' : 'invisible'}`}
                  >
                    {isFolded ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                  </button>
                  <div className="flex-1 py-1 px-3 bg-white/[0.02] border border-white/5 rounded-md text-[13px] md:text-[14px] leading-relaxed text-white group-hover/node:bg-white/[0.04] transition-all script-text-dynamic">
                    {node.text}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }
      case 'pdf': {
        const matchedResource = (scenario.images || []).find(r => r.id === block.content);
        const resolvedUrl = matchedResource ? matchedResource.url : block.content;
        const page = pdfPageStates?.[resolvedUrl] || 1;
        return (
          <PdfBlock 
            content={resolvedUrl} 
            label={block.label} 
            page={page} 
            onPageChange={(p) => onSetPdfPageState?.(resolvedUrl, p)} 
            onOpenSync={onOpenSync}
          />
        );
      }
      case 'image': {
        const matchedResource = (scenario.images || []).find(r => r.id === block.content);
        const resolvedUrl = matchedResource ? matchedResource.url : block.content;
        return <ImageBlock content={resolvedUrl} label={block.label} onOpenSync={onOpenSync} />;
      }
      default:
        return null;
    }
  }, [foldedNodes, isNodeHidden, toggleFold, scenario.images, pdfPageStates, onSetPdfPageState, onOpenSync]);

  const handleSaveChecklist = useCallback(() => {
    const cleaned = editingChecklists.map(c => c.trim()).filter(Boolean);
    if (onUpdateScenario && scenario.phases) {
      const updatedPhases = scenario.phases.map(p => {
        if (p.id === phase.id) {
          return { ...p, checklists: cleaned };
        }
        return p;
      });
      onUpdateScenario({ phases: updatedPhases });
    } else {
      phase.checklists = cleaned;
    }
    setIsEditingChecklist(false);
  }, [editingChecklists, onUpdateScenario, scenario.phases, phase]);

  const scriptFontSize = scenario.scriptFontSize || 18;

  return (
    <div 
      className="flex flex-col h-full bg-black/20 overflow-hidden relative pb-0"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 768px) {
          .script-text-dynamic, .script-text-dynamic p, .script-text-dynamic li, .script-text-dynamic span, .script-text-dynamic div {
            font-size: ${scriptFontSize}px !important;
          }
        }
      ` }} />
      <div className="flex border-b border-white/10 shrink-0 h-9 bg-black/40 backdrop-blur-md z-40">
        <button 
          onClick={() => onTabChange?.('guide')}
          className={`flex-1 px-4 py-0 transition-all flex flex-col justify-center text-left border-r border-white/10 relative group min-w-0
            ${activeTab === 'guide' ? 'bg-white/5' : 'bg-transparent hover:bg-white/[0.02]'}
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen size={12} className={`shrink-0 transition-colors ${activeTab === 'guide' ? 'text-white' : 'text-white/60 group-hover:text-white/75'}`} />
            <span className={`text-[10px] md:text-sm font-bold truncate font-cinzel tracking-tight transition-colors
              ${activeTab === 'guide' ? 'text-white' : 'text-white/75 group-hover:text-white/85'}
            `}>{scenarioTitle || scenario.title}</span>
          </div>
          {activeTab === 'guide' && <div className="absolute left-0 top-0 bottom-0 w-1 opacity-50" style={{ backgroundColor: scenario.themeColor || '#ffffff' }} />}
        </button>
        <button 
          onClick={() => onTabChange?.('characters')}
          className={`flex-1 px-4 py-0 transition-all flex flex-col justify-center text-left relative group min-w-0
            ${activeTab === 'characters' ? 'bg-white/5' : 'bg-transparent hover:bg-white/[0.02]'}
          `}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Users size={12} className={`shrink-0 transition-colors ${activeTab === 'characters' ? 'text-white' : 'text-white/60 group-hover:text-white/75'}`} />
            <span className={`text-[10px] md:text-sm font-bold truncate font-cinzel tracking-tight uppercase tracking-wider transition-colors
              ${activeTab === 'characters' ? 'text-white' : 'text-white/75 group-hover:text-white/85'}
            `}>Characters</span>
          </div>
          {activeTab === 'characters' && <div className="absolute left-0 top-0 bottom-0 w-1 opacity-50" style={{ backgroundColor: scenario.themeColor || '#ffffff' }} />}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'guide' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {(checklistPos === 'top' || checklistPos === 'both') && renderChecklist('top')}
            <div ref={scriptContentRef} className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-1 scrollbar-thin relative z-10 transition-all duration-300">
              <div className="space-y-8 md:space-y-12">
                {memoizedBlocks.length > 0 ? (
                  memoizedBlocks.slice(0, visibleCount).map((block) => (
                    <ScriptBlockItem key={block.stableKey || block.id} block={block} renderBlock={renderBlock} />
                  ))
                ) : phase.script ? (
                  <div className="prose prose-invert prose-red max-w-none animate-in fade-in duration-500">
                    <div 
                      className="markdown-content font-sans text-white/90 leading-relaxed text-[13px] md:text-[14px] bg-white/[0.02] p-5 md:p-6 md:pt-4 rounded-xl border border-white/5 shadow-inner script-text-dynamic"
                      dangerouslySetInnerHTML={{ __html: processScriptHtml(renderMarkdown(phase.script)) }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-white/20 italic">
                    <BookOpen size={48} strokeWidth={1} className="mb-4 opacity-20" />
                    <span className="text-[10px] uppercase font-black font-cinzel tracking-[0.3em]">No content in this phase / ScritpBlocks Empty</span>
                  </div>
                )}
              </div>
            </div>
            {(checklistPos === 'bottom' || checklistPos === 'both') && renderChecklist('bottom')}
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-4 md:p-6 scrollbar-thin space-y-3">
            {characters.map(char => (
              <div 
                key={char.id} 
                className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-start gap-4 hover:bg-white/[0.04] transition-all"
                style={{ borderLeftColor: char.color, borderLeftWidth: '3px' }}
              >
                <div className="shrink-0">
                  <UserCircle size={32} style={{ color: char.color || '#fff' }} className="drop-shadow-md" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-4 items-start lg:items-center">
                    <div className="flex flex-col truncate">
                      <span className="font-bold text-[13px] text-white truncate">{char.name}</span>
                      <span className="text-[9px] text-white/30 uppercase tracking-tighter">{char.role}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                       <button 
                         onClick={() => onOpenHandout?.(char.id)}
                         className="p-1 px-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5"
                         title="Share Individual Notification"
                       >
                         <ExternalLink size={12} />
                         <span className="text-[9px] font-bold font-cinzel">個別通知</span>
                       </button>
                       <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/5">
                          <button onClick={() => updateTokens(char.id, -1)} className="text-white/20 hover:text-white transition-colors"><Minus size={12}/></button>
                          <span className="text-xs font-mono font-bold text-amber-500 tabular-nums">{char.tokens}</span>
                          <button onClick={() => updateTokens(char.id, 1)} className="text-white/20 hover:text-white transition-colors"><Plus size={12}/></button>
                       </div>
                       <div className="flex gap-1">
                         {[0, 1, 2].map(idx => (
                           <button key={idx} onClick={() => toggleFlag(char.id, idx)} className={`w-6 h-6 rounded border ${char.flags?.[idx] ? 'bg-white/10' : 'border-white/5'}`} style={{ borderColor: char.flags?.[idx] ? FLAG_COLORS[idx] : undefined }}>
                             <Check size={10} className={`mx-auto ${char.flags?.[idx] ? 'opacity-100' : 'opacity-0'}`} style={{ color: FLAG_COLORS[idx] }} />
                           </button>
                         ))}
                       </div>
                    </div>
                  </div>
                  {char.comment && <p className="mt-1 text-[10px] text-white/20 italic truncate">{char.comment}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditingChecklist && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[900] p-4 animate-in fade-in duration-200">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col font-sans overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black font-cinzel text-white/40 tracking-widest uppercase">
                <Edit3 size={12} style={{ color: scenario.themeColor }} />
                <span>チェックリスト編集</span>
              </div>
              <button 
                onClick={() => setIsEditingChecklist(false)}
                className="text-white/30 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {editingChecklists.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-white/20 italic">
                  チェック項目がありません
                </div>
              ) : (
                <div className="space-y-2">
                  {editingChecklists.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 group/edit-item">
                      <input 
                        type="text"
                        value={item}
                        onChange={(e) => {
                          const next = [...editingChecklists];
                          next[index] = e.target.value;
                          setEditingChecklists(next);
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-white/30 transition-all font-sans"
                        placeholder="チェック項目を入力..."
                        autoFocus={index === editingChecklists.length - 1 && item === ''}
                      />
                      <button
                        onClick={() => {
                          setEditingChecklists(editingChecklists.filter((_, i) => i !== index));
                        }}
                        className="p-2 text-white/30 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => setEditingChecklists([...editingChecklists, ''])}
                className="w-full py-2 bg-white/[0.02] hover:bg-white/[0.04] border border-dashed border-white/10 rounded-lg text-[10px] font-black font-cinzel tracking-widest text-white/40 hover:text-white transition-all uppercase"
              >
                + チェック項目を追加
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsEditingChecklist(false)}
                className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-lg text-xs font-black font-cinzel tracking-widest transition-all uppercase"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveChecklist}
                className="px-5 py-2 rounded-lg text-xs font-black font-cinzel tracking-widest text-white transition-all uppercase"
                style={{ backgroundColor: scenario.themeColor || '#ef4444' }}
              >
                決定
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

ScriptViewer.displayName = 'ScriptViewer';

export default ScriptViewer;
