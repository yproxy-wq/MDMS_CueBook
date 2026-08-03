import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { VolumeX, RotateCcw, Monitor, Edit3, Search, Settings, X, Zap } from 'lucide-react';

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStopAllAudio: () => void;
  onResetTimer: () => void;
  onToggleEditorMode: () => void;
  onOpenSyncModal: () => void;
  isEditorMode?: boolean;
  onOpenPhaseSearch?: () => void;
  onOpenPreferences?: () => void;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  isOpen,
  onClose,
  onStopAllAudio,
  onResetTimer,
  onToggleEditorMode,
  onOpenSyncModal,
  isEditorMode = false,
  onOpenPhaseSearch,
  onOpenPreferences,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === '1') {
        onStopAllAudio();
        onClose();
      } else if (e.key === '2') {
        onResetTimer();
        onClose();
      } else if (e.key === '3') {
        onToggleEditorMode();
        onClose();
      } else if (e.key === '4') {
        onOpenSyncModal();
        onClose();
      } else if (e.key === '5' && onOpenPhaseSearch) {
        onOpenPhaseSearch();
        onClose();
      } else if (e.key === '6' && onOpenPreferences) {
        onOpenPreferences();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onStopAllAudio, onResetTimer, onToggleEditorMode, onOpenSyncModal, onOpenPhaseSearch, onOpenPreferences]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans text-white"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-cinzel tracking-wider uppercase text-white">
                    QUICK ACTIONS
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Shortcuts & Command Palette (Ctrl+Alt+Q)</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
              {onOpenPhaseSearch && (
                <button
                  onClick={() => { onOpenPhaseSearch(); onClose(); }}
                  className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/30 rounded-xl transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg group-hover:bg-violet-500 group-hover:text-white transition-colors"><Search className="w-4 h-4" /></div>
                    <div><div className="text-xs font-bold text-zinc-200 group-hover:text-violet-300">Find a Phase</div><div className="text-[10px] text-zinc-400">フェーズを検索してプレビューまたは移動</div></div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">5</span>
                </button>
              )}
              {onOpenPreferences && (
                <button
                  onClick={() => { onOpenPreferences(); onClose(); }}
                  className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-slate-500/10 border border-white/5 hover:border-slate-400/30 rounded-xl transition-all group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-500/10 text-slate-300 rounded-lg group-hover:bg-slate-500 group-hover:text-white transition-colors"><Settings className="w-4 h-4" /></div>
                    <div><div className="text-xs font-bold text-zinc-200 group-hover:text-white">Preferences</div><div className="text-[10px] text-zinc-400">表示・操作環境の設定を開く</div></div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">6</span>
                </button>
              )}
            </div>

            {/* Actions List */}
            <div className="p-4 space-y-2">
              <button
                onClick={() => {
                  onStopAllAudio();
                  onClose();
                }}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/30 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 text-red-400 rounded-lg group-hover:bg-red-500 group-hover:text-white transition-colors">
                    <VolumeX className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-red-300">
                      Stop All Audio
                    </div>
                    <div className="text-[10px] text-zinc-400">すべてのBGM/SEの再生を即時停止</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">
                  1
                </span>
              </button>

              <button
                onClick={() => {
                  onResetTimer();
                  onClose();
                }}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-amber-500/10 border border-white/5 hover:border-amber-500/30 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-amber-300">
                      Reset Active Timer
                    </div>
                    <div className="text-[10px] text-zinc-400">現在のアクティブタイマーを初期値にリセット</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">
                  2
                </span>
              </button>

              <button
                onClick={() => {
                  onToggleEditorMode();
                  onClose();
                }}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-sky-500/10 border border-white/5 hover:border-sky-500/30 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg group-hover:bg-sky-500 group-hover:text-white transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-sky-300">
                      Toggle Mode ({isEditorMode ? 'Switch to GM Mode' : 'Switch to Editor Mode'})
                    </div>
                    <div className="text-[10px] text-zinc-400">GM進行モードとエディタモードの切り替え</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">
                  3
                </span>
              </button>

              <button
                onClick={() => {
                  onOpenSyncModal();
                  onClose();
                }}
                className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300">
                      Open Sync Studio
                    </div>
                    <div className="text-[10px] text-zinc-400">プレイヤー同期画面（Sync Studio）設定を開く</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-black/40 border border-white/10 rounded text-zinc-400 group-hover:text-white">
                  4
                </span>
              </button>
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 bg-black/40 border-t border-white/5 text-[10px] text-zinc-500 flex items-center justify-between font-mono">
               <span>Press 1-6 or click to trigger</span>
              <span>ESC to cancel</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
