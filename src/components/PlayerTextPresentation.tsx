import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';
import { renderMarkdown } from '../utils/markdown';
import { PlayerTextBlock } from '../utils/playerTextPresentation';

interface PlayerTextPresentationProps {
  entries: PlayerTextBlock[];
  phaseName: string;
  onClose: () => void;
}

const TEXT_SIZES = [18, 22, 26] as const;

/**
 * A local, full-screen reading mode for handing the current tablet to players.
 * It deliberately does not share state to the projection window.
 */
export const PlayerTextPresentation: React.FC<PlayerTextPresentationProps> = ({
  entries,
  phaseName,
  onClose,
}) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [textSizeIndex, setTextSizeIndex] = useState(1);
  const safePageIndex = Math.min(pageIndex, Math.max(0, entries.length - 1));
  const entry = entries[safePageIndex];

  const html = useMemo(() => entry ? renderMarkdown(entry.content) : '', [entry]);
  if (!entry || typeof document === 'undefined') return null;

  const canGoBack = safePageIndex > 0;
  const canGoForward = safePageIndex < entries.length - 1;
  const textSize = TEXT_SIZES[textSizeIndex];

  return createPortal(
    <section
      aria-label="プレイヤー本文表示"
      className="fixed inset-0 z-[2000] flex min-h-dvh flex-col bg-[#08090b] text-white"
    >
      <header className="flex min-h-12 items-center justify-between border-b border-white/10 bg-black/60 px-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Player Reading</p>
          <p className="truncate text-xs font-semibold text-white/70">{entry.label || phaseName}</p>
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="文字を小さく"
            disabled={textSizeIndex === 0}
            onClick={() => setTextSizeIndex((index) => Math.max(0, index - 1))}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <Minus size={18} />
          </button>
          <button
            type="button"
            aria-label="文字を大きく"
            disabled={textSizeIndex === TEXT_SIZES.length - 1}
            onClick={() => setTextSizeIndex((index) => Math.min(TEXT_SIZES.length - 1, index + 1))}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            aria-label="プレイヤー本文表示を閉じる"
            onClick={onClose}
            className="ml-1 flex min-h-11 items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            <X size={16} />
            <span>戻る</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-5 py-8 sm:px-10 md:px-16 md:py-12">
        <article
          className="prose prose-invert mx-auto max-w-4xl text-white prose-headings:font-cinzel prose-headings:text-white prose-p:leading-[1.85] prose-li:leading-[1.8] prose-strong:text-white"
          style={{ fontSize: textSize + 'px' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>

      {entries.length > 1 && (
        <footer className="flex min-h-14 items-center justify-between border-t border-white/10 bg-black/60 px-3 sm:px-5">
          <button
            type="button"
            aria-label="前の本文へ"
            disabled={!canGoBack}
            onClick={() => setPageIndex((index) => index - 1)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-bold text-white/65 transition-colors hover:bg-white/10 disabled:opacity-25"
          >
            <ChevronLeft size={18} /> 前へ
          </button>
          <span className="font-mono text-xs text-white/40">{safePageIndex + 1} / {entries.length}</span>
          <button
            type="button"
            aria-label="次の本文へ"
            disabled={!canGoForward}
            onClick={() => setPageIndex((index) => index + 1)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-3 text-sm font-bold text-white/65 transition-colors hover:bg-white/10 disabled:opacity-25"
          >
            次へ <ChevronRight size={18} />
          </button>
        </footer>
      )}
    </section>,
    document.body,
  );
};
