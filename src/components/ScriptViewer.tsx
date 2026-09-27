
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Phase, Scenario, ScriptBlock } from '../types';
import { CheckSquare, Plus, Minus, ChevronDown, ChevronUp, BookOpen, FileText, ExternalLink, Share, Edit3, Trash2, X, MonitorUp } from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import { OutlineBlock } from './OutlineBlock';
import { parseOutlineNodes } from '../utils/scriptOutline';
import { QuickNote } from './QuickNote';
import { PlayerTextPresentation } from './PlayerTextPresentation';
import { isPlayerTextBlock, selectPlayerTextBlocks } from '../utils/playerTextPresentation';
import { useOwnerMediaUrl } from '../hooks/useOwnerMediaUrl';
import { isR2AssetUrl } from '../services/R2AssetService';

interface ScriptViewerProps {
  phase: Phase;
  scenario: Scenario;
  scenarioTitle?: string;
  onToggleChecklist?: (phaseId: string, index: number) => void;
  onShowImage?: (imageId: string | null) => void;
  activeImageId?: string | null;
  isPreviewing?: boolean;
  pdfPageStates?: Record<string, number>;
  onSetPdfPageState?: (id: string, page: number) => void;
  onOpenSync?: () => void;
  onUpdateScenario?: (updates: Partial<Scenario>) => void;
}

const EMPTY_PLAYER_TEXT_IDS: ReadonlySet<string> = new Set();

const ImageBlock: React.FC<{ 
  content: string; 
  label?: string;
  onOpenSync?: () => void;
}> = React.memo(({ content, label, onOpenSync }) => {
  const displayUrl = useOwnerMediaUrl(content);
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
        {displayUrl ? (
          <img 
            src={displayUrl} 
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
  const resolvedContentUrl = useOwnerMediaUrl(content);

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
  const isR2Source = isR2AssetUrl(content);
  const displayUrl = blobUrl || (!isDataUri ? resolvedContentUrl : null);
  
  const fullUrl = useMemo(() => {
    if (!displayUrl) return null;
    if (isDataUri) return `${displayUrl}#navpanes=0&view=Fit&zoom=page-fit&page=${page}`;
    if (isR2Source) return `${displayUrl}#navpanes=0&view=Fit&zoom=page-fit&page=${page}`;
    
    // Dropbox etc
    return `https://docs.google.com/viewer?url=${encodeURIComponent(displayUrl)}&embedded=true&page=${page}&zoom=page-fit`;
  }, [displayUrl, page, isDataUri, isR2Source]);

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
  renderBlock: (block: ProcessedBlock) => React.ReactNode,
  isSelectedForPlayer: boolean,
  onTogglePlayerText: (blockId: string) => void,
}> = React.memo(({ block, renderBlock, isSelectedForPlayer, onTogglePlayerText }) => {
  const canShowToPlayer = isPlayerTextBlock(block);
  return (
    <div className="script-block-item relative animate-in fade-in slide-in-from-bottom-2 duration-500">
      {canShowToPlayer && (
        <button
          type="button"
          aria-label={(isSelectedForPlayer ? 'プレイヤー表示から外す: ' : 'プレイヤー表示に追加: ') + (block.label || block.id)}
          aria-pressed={isSelectedForPlayer}
          onClick={() => onTogglePlayerText(block.id)}
          className={isSelectedForPlayer
            ? 'absolute right-2 top-2 z-20 flex min-h-11 items-center gap-1 rounded-lg border border-sky-300/45 bg-sky-500/20 px-2.5 text-[10px] font-black text-sky-100 shadow-lg'
            : 'absolute right-2 top-2 z-20 flex min-h-11 items-center gap-1 rounded-lg border border-white/10 bg-black/55 px-2.5 text-[10px] font-black text-white/50 backdrop-blur transition-colors hover:border-sky-300/35 hover:text-sky-100'}
        >
          <MonitorUp size={14} />
          {isSelectedForPlayer ? '選択中' : 'PL表示'}
        </button>
      )}
      {renderBlock(block)}
    </div>
  );
});

const ScriptViewer: React.FC<ScriptViewerProps> = React.memo(({ 
  phase, 
  scenario, 
  scenarioTitle,
  onToggleChecklist, 
  onShowImage,
  activeImageId,
  isPreviewing,
  pdfPageStates,
  onSetPdfPageState,
  onOpenSync,
  onUpdateScenario,
}) => {
  const [isChecklistFolded, setIsChecklistFolded] = useState(false);
  const activeTab = 'guide' as const;
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editingChecklists, setEditingChecklists] = useState<string[]>([]);
  const [playerTextSelection, setPlayerTextSelection] = useState<{ phaseId: string; ids: Set<string> }>({
    phaseId: phase.id,
    ids: new Set(),
  });
  const [playerPresentationPhaseId, setPlayerPresentationPhaseId] = useState<string | null>(null);
  const scriptContentRef = useRef<HTMLDivElement>(null);
  const playerTextSelectedIds = useMemo(
    () => playerTextSelection.phaseId === phase.id ? playerTextSelection.ids : EMPTY_PLAYER_TEXT_IDS,
    [phase.id, playerTextSelection],
  );
  const selectedPlayerTextBlocks = useMemo(
    () => selectPlayerTextBlocks(phase, playerTextSelectedIds),
    [phase, playerTextSelectedIds],
  );

  const togglePlayerTextSelection = useCallback((blockId: string) => {
    setPlayerTextSelection((previous) => {
      const next = previous.phaseId === phase.id ? new Set(previous.ids) : new Set<string>();
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return { phaseId: phase.id, ids: next };
    });
  }, [phase.id]);

  // Performance: For very long scripts, we might want to limit visible blocks or use deferred rendering
  const [visibleByPhase, setVisibleByPhase] = useState<Record<string, number>>({});
  const visibleCount = visibleByPhase[phase.id] ?? 15;
  const revealMore = useCallback(() => {
    setVisibleByPhase(previous => ({
      ...previous,
      [phase.id]: (previous[phase.id] ?? 15) + 15,
    }));
  }, [phase.id]);
  
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = revealRef.current;
    const root = scriptContentRef.current;
    if (!sentinel || !root || visibleCount >= (phase.scriptBlocks?.length || 0)) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) revealMore();
    }, { root, rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [phase.id, phase.scriptBlocks?.length, visibleCount, activeTab, revealMore]);

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
      const safeId = String(id).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      })[character]!);
      const isActive = false;
      // Brutalist elegant button style
      return `<button 
        class="image-sync-btn px-2 py-0.5 mx-1 rounded border transition-all duration-300 font-mono text-[10px] font-bold cursor-pointer inline-flex items-center gap-1.5
          ${isActive 
            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
            : 'bg-white/5 border-white/10 text-white/40 hover:text-white/80 hover:border-white/30 hover:bg-white/10'}
        " 
        data-img-id="${safeId}"
        title="Sync Image: ${safeId}"
      >
        <span class="w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-white/20'}"></span>
        ${safeId}
      </button>`;
    });
  }, []);


  useEffect(() => {
    scriptContentRef.current?.querySelectorAll<HTMLButtonElement>('.image-sync-btn').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.imgId === activeImageId));
    });
  }, [activeImageId, phase.id, phase.scriptBlocks, visibleCount, activeTab]);

  const memoizedBlocks = useMemo(() => {
    const pdfContentCounts: Record<string, number> = {};

    return (phase.scriptBlocks || []).slice(0, visibleCount).map(block => {
      let stableKey = JSON.stringify([scenario.id, phase.id, block.id]);

      if (block.type === 'pdf') {
        const content = block.content;
        pdfContentCounts[content] = (pdfContentCounts[content] || 0) + 1;
        // Use content-based key for PDFs to persist across phases, 
        // but include index-like suffix if multiple identical PDFs exist in one phase
        stableKey = `pdf-${content.slice(0, 100)}-${pdfContentCounts[content]}`;
      }

      if (block.type === 'markdown') {
        const baseHtml = renderMarkdown(block.content);

        return {
          ...block,
          stableKey,
          html: processScriptHtml(baseHtml)
        };
      } else if (block.type === 'outline') {
        return {
          ...block,
          stableKey,
          nodes: parseOutlineNodes(block.content)
        };
      } else {
        return {
          ...block,
          stableKey
        };
      }
    });
  }, [scenario.id, phase.id, phase.scriptBlocks, processScriptHtml, visibleCount]);

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
      case 'outline':
        return <OutlineBlock key={JSON.stringify([scenario.id, phase.id, block.id, block.content])} nodes={block.nodes || []} label={block.label} />;
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
  }, [scenario.id, phase.id, scenario.images, pdfPageStates, onSetPdfPageState, onOpenSync]);

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
    }
    setIsEditingChecklist(false);
  }, [editingChecklists, onUpdateScenario, scenario.phases, phase]);

  const scriptFontSize = scenario.scriptFontSize;

  return (
    <div 
      className="script-viewer flex flex-col h-full bg-black/20 overflow-hidden relative pb-0"
      style={{ '--script-font-size': scriptFontSize ? `${scriptFontSize}px` : undefined } as React.CSSProperties}
    >
      <div className="flex border-b border-white/10 shrink-0 min-h-11 bg-black/40 backdrop-blur-md z-40">
        <button 
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
        {/* キャラクター一覧は進行画面から撤廃 */}
        <button
          type="button"
          aria-label="選択した本文をプレイヤー表示する"
          disabled={selectedPlayerTextBlocks.length === 0}
          onClick={() => setPlayerPresentationPhaseId(phase.id)}
          className="flex min-h-11 shrink-0 items-center gap-1 border-l border-white/10 px-3 text-[10px] font-black text-white/60 transition-colors hover:bg-sky-500/10 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <MonitorUp size={14} />
          <span className="hidden sm:inline">PL表示</span>
          {selectedPlayerTextBlocks.length > 0 && <span className="font-mono text-sky-300">{selectedPlayerTextBlocks.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="flex flex-col h-full overflow-hidden">
            {(checklistPos === 'top' || checklistPos === 'both') && renderChecklist('top')}
            <div ref={scriptContentRef} className="flex-1 overflow-y-auto p-4 md:p-6 md:pt-1 scrollbar-thin relative z-10 transition-all duration-300">
              <div className="space-y-8 md:space-y-12">
                {memoizedBlocks.length > 0 ? (
                  memoizedBlocks.slice(0, visibleCount).map((block) => (
                    <ScriptBlockItem
                      key={block.stableKey || block.id}
                      block={block}
                      renderBlock={renderBlock}
                      isSelectedForPlayer={playerTextSelectedIds.has(block.id)}
                      onTogglePlayerText={togglePlayerTextSelection}
                    />
                  ))
                ) : phase.script ? (
                  <div className="prose prose-invert prose-red max-w-none animate-in fade-in duration-500">
                    <button
                      type="button"
                      aria-label="プレイヤー表示に追加: この本文"
                      aria-pressed={playerTextSelectedIds.has('legacy-script')}
                      onClick={() => togglePlayerTextSelection('legacy-script')}
                      className={playerTextSelectedIds.has('legacy-script')
                        ? 'mb-2 flex min-h-11 items-center gap-1 rounded-lg border border-sky-300/45 bg-sky-500/20 px-2.5 text-[10px] font-black text-sky-100'
                        : 'mb-2 flex min-h-11 items-center gap-1 rounded-lg border border-white/10 bg-black/55 px-2.5 text-[10px] font-black text-white/50 hover:border-sky-300/35 hover:text-sky-100'}
                    >
                      <MonitorUp size={14} />
                      {playerTextSelectedIds.has('legacy-script') ? '選択中' : 'PL表示'}
                    </button>
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
              {visibleCount < (phase.scriptBlocks?.length || 0) && <div ref={revealRef} className="py-4">
                <button type="button" className="min-h-11 px-4 text-sm text-white/70" onClick={revealMore}>続きを表示</button>
              </div>}
            </div>
            {(checklistPos === 'bottom' || checklistPos === 'both') && renderChecklist('bottom')}
        </div>
      </div>

      {playerPresentationPhaseId === phase.id && selectedPlayerTextBlocks.length > 0 && (
        <PlayerTextPresentation
          entries={selectedPlayerTextBlocks}
          phaseName={phase.name}
          onClose={() => setPlayerPresentationPhaseId(null)}
        />
      )}

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
