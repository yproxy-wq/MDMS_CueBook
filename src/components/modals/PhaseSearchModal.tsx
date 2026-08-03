import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Eye, Play, X, Command, Clock, CheckSquare, Sparkles } from 'lucide-react';
import { Phase } from '../../types';

interface PhaseSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  phases: Phase[];
  activePhaseId: string;
  previewPhaseId: string;
  onPhasePreview: (id: string) => void;
  onPhaseTransition: (id: string) => void;
  themeColor: string;
}

export const PhaseSearchModal: React.FC<PhaseSearchModalProps> = ({
  isOpen,
  onClose,
  phases = [],
  activePhaseId,
  previewPhaseId,
  onPhasePreview,
  onPhaseTransition,
  themeColor = '#1e50a2'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter phases based on search query
  const filteredPhases = useMemo(() => {
    if (!searchQuery.trim()) return phases;
    const q = searchQuery.toLowerCase();
    return phases.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.id.toLowerCase().includes(q)
    );
  }, [phases, searchQuery]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  // Keyboard navigation within command palette
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredPhases.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredPhases.length) % Math.max(1, filteredPhases.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredPhases[selectedIndex];
        if (selected) {
          if (e.shiftKey) {
            // Shift+Enter transitions/starts the phase
            onPhaseTransition(selected.id);
          } else {
            // Enter previews the phase
            onPhasePreview(selected.id);
          }
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, filteredPhases, selectedIndex, onPhasePreview, onPhaseTransition, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-[10vh] px-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-lg cursor-pointer"
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.97, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -10 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative bg-zinc-950/95 border border-white/10 w-full max-w-xl rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10 flex flex-col max-h-[80vh]"
        >
          {/* Header Command Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-white/[0.01]">
            <Search size={18} className="text-white/40 shrink-0" />
            <input 
              ref={inputRef}
              type="text"
              placeholder="フェーズ名やキーワードで検索..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent border-none text-white placeholder-white/30 text-xs focus:ring-0 focus:outline-none"
            />
            <div className="flex items-center gap-1 shrink-0 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md text-[9px] font-bold font-mono text-white/50 tracking-wide uppercase">
              <Command size={10} className="mr-0.5" /> ESC
            </div>
            <button 
              onClick={onClose}
              className="p-1 rounded bg-transparent hover:bg-white/5 text-white/40 hover:text-white transition-all"
            >
              <X size={14} />
            </button>
          </div>

          {/* List of filtered phases */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 min-h-[160px] max-h-[450px]">
            {filteredPhases.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-3">
                <Search size={28} className="text-white/15 stroke-[1.5]" />
                <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest leading-none">
                  一致するフェーズが見つかりません
                </span>
              </div>
            ) : (
              <div ref={listRef} className="space-y-1">
                {filteredPhases.map((phase, idx) => {
                  const isSelected = idx === selectedIndex;
                  const isActive = phase.id === activePhaseId;
                  const isPreview = phase.id === previewPhaseId;
                  
                  return (
                    <div
                      key={phase.id}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => {
                        onPhasePreview(phase.id);
                        onClose();
                      }}
                      className={`group relative p-3 rounded-xl transition-all duration-150 border flex items-center justify-between gap-4 cursor-pointer ${
                        isSelected 
                          ? 'bg-zinc-900 border-white/20 shadow-md translate-x-0.5' 
                          : 'bg-transparent border-transparent hover:bg-white/[0.01] hover:translate-x-0.5'
                      }`}
                      style={{
                        borderColor: isSelected ? themeColor : undefined,
                        boxShadow: isSelected ? `0 0 20px ${themeColor}15` : 'none'
                      }}
                    >
                      {/* Left: Metadata & Titles */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Number Display */}
                        <div 
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border font-mono font-black text-xs transition-all ${
                            isActive 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                              : isSelected 
                                ? 'bg-white/10 border-white/20 text-white' 
                                : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                          style={{
                            color: !isActive && isSelected ? themeColor : undefined,
                            borderColor: !isActive && isSelected ? `${themeColor}40` : undefined,
                            backgroundColor: !isActive && isSelected ? `${themeColor}10` : undefined,
                          }}
                        >
                          {phase.id.split('-').pop()?.toUpperCase() || 'P'}
                        </div>

                        {/* Title and description */}
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] md:text-sm font-bold font-sans tracking-tight transition-colors ${
                              isActive ? 'text-emerald-400' : isSelected ? 'text-white' : 'text-white/70'
                            }`}>
                              {phase.name}
                            </span>
                            
                            {/* Badges */}
                            {isActive && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-[7px] text-emerald-400 rounded-md font-bold font-mono tracking-widest uppercase animate-pulse">
                                Active Live
                              </span>
                            )}
                            {isPreview && !isActive && (
                              <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[7px] text-white/50 rounded-md font-bold font-mono tracking-widest uppercase">
                                Previewing
                              </span>
                            )}
                          </div>
                          
                          {phase.description && (
                            <p className="text-[9.5px] text-white/40 leading-relaxed font-sans line-clamp-1">
                              {phase.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Middle: Details (Cheklists, duration) */}
                      <div className="flex items-center gap-3 shrink-0">
                        {phase.checklists && phase.checklists.length > 0 && (
                          <div className="flex items-center gap-1 text-[9px] font-mono text-white/40 bg-white/[0.02] border border-white/5 px-2 py-0.5 rounded-md">
                            <CheckSquare size={10} className="text-white/30" />
                            <span>{phase.checklists.length}</span>
                          </div>
                        )}
                        
                        {phase.targetDurationMinutes > 0 && (
                          <div className="flex items-center gap-1 text-[9px] font-mono text-white/40 bg-white/[0.02] border border-white/5 px-2 py-0.5 rounded-md">
                            <Clock size={10} className="text-white/30" />
                            <span>{phase.targetDurationMinutes}分</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Quick actions when selected */}
                      <div className="flex items-center gap-1.5 shrink-0 min-w-[70px] justify-end">
                        {isSelected ? (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPhasePreview(phase.id);
                                onClose();
                              }}
                              title="Enter to Preview"
                              className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                            >
                              <Eye size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPhaseTransition(phase.id);
                                onClose();
                              }}
                              title="Shift+Enter to Start Phase"
                              className="p-1.5 rounded-lg transition-all text-white border border-transparent shadow-lg"
                              style={{
                                backgroundColor: themeColor,
                                boxShadow: `0 0 10px ${themeColor}40`
                              }}
                            >
                              <Play size={12} className="fill-white" />
                            </button>
                          </>
                        ) : (
                          <div className="w-5" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer guides */}
          <div className="px-4 py-3 bg-white/[0.01] border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-white/30">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-white/5 border border-white/10 rounded">▲▼</kbd> 選択
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-white/5 border border-white/10 rounded">Enter</kbd> プレビュー
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-white/5 border border-white/10 rounded">Shift</kbd> + <kbd className="px-1 bg-white/5 border border-white/10 rounded">Enter</kbd> 進行に即反映
              </span>
            </div>
            <div className="flex items-center gap-1 text-[8px] font-bold tracking-widest text-white/20 uppercase">
              <Sparkles size={10} className="text-white/10" /> CueBook Performance Engine
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
