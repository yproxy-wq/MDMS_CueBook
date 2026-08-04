import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, BookOpen, Check, Download, Edit3, FileUp, Keyboard, Loader2, RotateCcw, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { ScenarioRegistryEntry } from '../../services/ScenarioRegistryService';

interface ScenarioManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  entries: ScenarioRegistryEntry[];
  currentScenarioId: string;
  isEditorMode: boolean;
  switching: boolean;
  onSelect: (entry: ScenarioRegistryEntry) => void;
  onRegister?: () => void;
  onToggleEditor: () => void;
  onImport: () => void;
  onExport: (format?: 'zip' | 'cuebook') => void;
  onReset?: () => void;
  onResetSession?: () => void;
}

const statusLabel = (entry: ScenarioRegistryEntry) => {
  if (entry.availability === 'available') return { label: 'READY', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' };
  if (entry.availability === 'mismatch') return { label: 'UPDATE', className: 'text-amber-300 bg-amber-500/10 border-amber-500/20' };
  if (entry.availability === 'syncing') return { label: 'SYNC', className: 'text-sky-300 bg-sky-500/10 border-sky-500/20' };
  return { label: 'BIND', className: 'text-white/60 bg-white/5 border-white/10' };
};

const ScenarioManagerModal: React.FC<ScenarioManagerModalProps> = ({
  isOpen,
  onClose,
  user,
  entries,
  currentScenarioId,
  isEditorMode,
  switching,
  onSelect,
  onRegister,
  onToggleEditor,
  onImport,
  onExport,
  onReset,
  onResetSession,
}) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-emerald-400/25 bg-[#090b0c] shadow-[0_30px_120px_rgba(0,0,0,0.75)]"
          role="dialog"
          aria-modal="true"
          aria-label="シナリオ管理"
        >
          <header className="flex items-center justify-between border-b border-white/10 bg-emerald-500/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <BookOpen className="text-emerald-300" size={20} />
              <div>
                <div className="font-cinzel text-xs font-bold tracking-[0.28em] text-emerald-300">SCENARIO MANAGEMENT</div>
                <div className="mt-1 text-[10px] text-white/40">シナリオ、端末ファイル、進行状態をまとめて管理</div>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-white/45 hover:bg-white/10 hover:text-white" aria-label="閉じる"><X size={18} /></button>
          </header>

          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1.3fr_0.7fr]">
            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-[9px] tracking-[0.2em] text-white/35">MY SCENARIOS</div>
                {user && onRegister && (
                  <button onClick={onRegister} disabled={switching} className="text-[10px] text-sky-300 hover:text-sky-200 disabled:opacity-50">+ この端末のシナリオを登録</button>
                )}
              </div>
              <div className="space-y-2">
                {entries.length === 0 && <div className="rounded-xl border border-dashed border-white/10 p-7 text-center text-xs text-white/35">登録済みシナリオはありません。</div>}
                {entries.map((entry, index) => {
                  const status = statusLabel(entry);
                  const current = entry.scenarioId === currentScenarioId;
                  return (
                    <button
                      key={entry.scenarioId}
                      onClick={() => onSelect(entry)}
                      disabled={switching || current}
                      className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all ${current ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-emerald-300/30 hover:bg-white/[0.06]'} disabled:cursor-default disabled:opacity-80`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-[11px] ${current ? 'border-emerald-300/40 text-emerald-200' : 'border-white/10 text-white/35'}`}>{index + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-white/85">{entry.title}</span>
                        <span className="mt-1 block truncate font-mono text-[9px] text-white/30">{entry.scenarioId}</span>
                      </span>
                      <span className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[8px] tracking-wider ${status.className}`}>{current ? 'CURRENT' : status.label}</span>
                      {current && <Check size={15} className="shrink-0 text-emerald-300" />}
                    </button>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2 font-cinzel text-[10px] font-bold tracking-widest text-white/60"><Keyboard size={14} /> QUICK SWITCH</div>
                <p className="text-[10px] leading-relaxed text-white/45">一覧順のショートカットで、どの画面からでも即時切り替えできます。</p>
                <div className="mt-3 space-y-1.5">
                  {entries.slice(0, 9).map((entry, index) => (
                    <div key={entry.scenarioId} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="truncate text-white/60">{entry.title}</span>
                      <kbd className="shrink-0 rounded border border-white/10 bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">Ctrl+Shift+{index + 1}</kbd>
                    </div>
                  ))}
                  {entries.length === 0 && <span className="text-[10px] text-white/25">シナリオを登録すると表示されます。</span>}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                <button onClick={() => { onToggleEditor(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-sky-300 hover:bg-sky-400/10"><Edit3 size={15} />{isEditorMode ? '通常モード（SESSION）' : '編集ウィンドウ（EDIT）'}</button>
                <button onClick={() => { onImport(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"><FileUp size={15} />インポート</button>
                <button onClick={() => { onExport('cuebook'); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-white/70 hover:bg-white/5 hover:text-white"><Download size={15} />エクスポート</button>
                {!isEditorMode && onResetSession && <button onClick={() => { onResetSession(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-amber-300 hover:bg-amber-400/10"><RotateCcw size={15} />セッションリセット</button>}
                {onReset && <button onClick={() => { onReset(); onClose(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-red-300 hover:bg-red-400/10"><AlertTriangle size={15} />シナリオ／アプリリセット</button>}
              </div>

              {switching && <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 font-mono text-[9px] text-amber-300"><Loader2 className="animate-spin" size={13} /> SCENARIO SWITCHING…</div>}
            </aside>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ScenarioManagerModal;
