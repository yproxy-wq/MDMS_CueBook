import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/** Display-only confirmation; all timer mutations stay in the existing handler. */
export const TimerTapControl = React.memo(function TimerTapControl({
  isRunning, disabled, onToggle, children,
}: {
  isRunning: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    actionRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative grid min-h-[44px] min-w-24 items-center"
      onKeyDown={event => {
        // Keep native button activation from also firing the global timer shortcut.
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (!event.repeat && event.target instanceof HTMLButtonElement) event.target.click();
        }
      }}>
      <button ref={triggerRef} type="button" disabled={disabled}
        aria-label="タイマーの開始・停止操作を表示" aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="flex min-h-[44px] min-w-24 touch-manipulation items-center justify-center rounded-lg px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40">
        {children}
      </button>
      {isOpen && (
        <button ref={actionRef} type="button" disabled={disabled}
          aria-label={isRunning ? 'タイマーを停止' : 'タイマーを開始'}
          onClick={() => {
            setIsOpen(false);
            triggerRef.current?.focus();
            onToggle();
          }}
          className="absolute inset-0 flex min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-lg border border-white/30 bg-zinc-950/75 font-sans text-sm font-bold text-white shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          {isRunning ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          {isRunning ? '停止' : '開始'}
        </button>
      )}
    </div>
  );
});