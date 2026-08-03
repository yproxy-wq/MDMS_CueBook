import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Scenario } from '../types';
import PhaseCard from './PhaseCard';
import { useDisplayNow } from '../hooks/useDisplayNow';

interface PhaseProgressNavProps {
  scenario: Scenario;
  activePhaseId: string;
  previewPhaseId: string;
  themeColor: string;
  onPhasePreview: (id: string) => void;
  onPhaseTransition: (id: string) => void;
  timerStates: Record<string, { seconds: number; isRunning: boolean; startTime?: number | null }>;
  onToggleTimer: (id: string) => void;
  onStartSession: () => void;
  onSetCompleted: (id: string, completed: boolean) => void;
  isPaused: boolean;
  sessionStartTime?: number;
  onOpenPhasePopup: () => void;
  position: 'top' | 'bottom';
  onResetTimer?: (id: string) => void;
}

export const PhaseProgressNav: React.FC<PhaseProgressNavProps> = React.memo(({
  scenario,
  activePhaseId,
  previewPhaseId,
  themeColor,
  onPhasePreview,
  onPhaseTransition,
  timerStates,
  onToggleTimer,
  onStartSession,
  onSetCompleted,
  isPaused,
  sessionStartTime,
  onOpenPhasePopup,
  position,
  onResetTimer
}) => {
  const now = useDisplayNow(250);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phases = scenario.phases || [];
  const activePhase = phases.find(p => p.id === activePhaseId);
  const previewPhase = previewPhaseId ? phases.find(p => p.id === previewPhaseId) : null;
  const previewIndex = previewPhaseId ? phases.findIndex(p => p.id === previewPhaseId) : -1;

  // 1桁の分を「MM:00」形式にフォーマット
  const formatMinutes = (minutes: number) => {
    const m = Math.floor(minutes);
    return `${m.toString().padStart(2, '0')}:00`;
  };

  // フェーズの目標時間合計を計算
  const getPhaseTargetMin = (p: typeof phases[0]) => {
    return p.targetDurationMinutes || 
      (((p.timers || []).reduce((acc, t) => acc + (t.durationMinutes || 0), 0)) + (p.bufferDurationMinutes || 0));
  };

  // フェーズのアクティブタイマー残り時間
  const getPhaseRunningSecs = (p: typeof phases[0]) => {
    const timerId = p.timers?.[0]?.id || '';
    const tState = timerStates[timerId];
    const totalSecs = p.timeMinutes ? (p.timeMinutes * 60) : (p.timers?.[0]?.durationMinutes ? p.timers[0].durationMinutes * 60 : 300);
    return tState ? (
      tState.isRunning && tState.startTime
        ? Math.max(0, tState.seconds - (now - tState.startTime) / 1000)
        : tState.seconds
    ) : totalSecs;
  };

  // 各タイマーの経過時間（経過秒数）
  const getTimerElapsedSecs = (timer: typeof phases[0]['timers'][0]) => {
    const tState = timerStates[timer.id];
    const limitSecs = timer.durationMinutes * 60;
    const runningSecs = tState ? (
      tState.isRunning && tState.startTime
        ? Math.max(0, tState.seconds - (now - tState.startTime) / 1000)
        : tState.seconds
    ) : limitSecs;
    return Math.max(0, limitSecs - runningSecs);
  };

  const [highlightedPhaseId, setHighlightedPhaseId] = useState<string | null>(null);

  useEffect(() => {
    if (activePhaseId) {
      // Avoid synchronous setState inside effect using requestAnimationFrame
      const frameId = requestAnimationFrame(() => {
        setHighlightedPhaseId(activePhaseId);
      });
      const timer = setTimeout(() => {
        setHighlightedPhaseId(null);
      }, 4000);
      return () => {
        cancelAnimationFrame(frameId);
        clearTimeout(timer);
      };
    }
  }, [activePhaseId]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isPhaseUnlocked = (index: number) => {
    const phase = phases[index];
    if (!phase || !phase.isLockedByPrevious || index === 0) return true;
    const prevPhase = phases[index - 1];
    if (!prevPhase) return true;
    const results = prevPhase.checklistResults || [];
    const isChecklistComplete = prevPhase.checklists && prevPhase.checklists.length > 0 && prevPhase.checklists.every((_, i) => results[i] === true);
    return isChecklistComplete && prevPhase.isCompleted;
  };

  // Draggable-scrolling feel using pointer events
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!scrollRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeft.current = scrollRef.current.scrollLeft;
    scrollRef.current.style.userSelect = 'none';
    scrollRef.current.style.cursor = 'grabbing';
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // scroll-speed
    scrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  const handlePointerUpOrLeave = () => {
    isDragging.current = false;
    if (scrollRef.current) {
      scrollRef.current.style.userSelect = '';
      scrollRef.current.style.cursor = 'grab';
    }
  };

  return (
    <div className="w-full flex flex-col shrink-0 z-[40] relative">
      {position === 'bottom' && activePhase && (
        <AnimatePresence key="details-presence-bottom">
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full bg-zinc-950 px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-t border-white/10 text-[10px] md:text-[11px] font-mono text-white/50 select-none tracking-wider overflow-hidden shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse`}
                style={{ backgroundColor: activePhase.themeColor || themeColor, boxShadow: `0 0 6px ${activePhase.themeColor || themeColor}` }}
              />
              <span className="text-white/30 font-black font-cinzel">PHASE INFO &gt;&gt;</span>
              <span className="font-bold text-white uppercase font-sans">[{activePhase.name}]</span>
              {activePhase.description && (
                <span className="text-white/40 truncate max-w-[200px] font-sans">({activePhase.description})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 font-black font-cinzel">TARGET GOAL:</span>
                <span className="font-black text-sky-400 text-xs tracking-tight bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                  {getPhaseTargetMin(activePhase)}分
                </span>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-white/30 font-black font-cinzel">BREAKDOWN:</span>
              <div className="flex items-center flex-wrap gap-1">
                {(activePhase.timers || []).length > 0 ? (
                  (activePhase.timers || []).map((t, i) => (
                    <span key={t.id} className="bg-white/5 text-white/70 px-1.5 py-0.5 rounded border border-white/5 text-[9px] flex items-center gap-1">
                      <span className="text-white/40 font-bold">{i + 1}.</span> {t.label}: <strong className="text-white font-black">{t.durationMinutes}分</strong>
                    </span>
                  ))
                ) : (
                  <span className="text-white/20 italic text-[9px]">タイマーなし</span>
                )}
                {(activePhase.bufferDurationMinutes || 0) > 0 && (
                  <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 text-[9px] font-bold">
                    バッファ: <strong className="text-amber-200 font-black">{activePhase.bufferDurationMinutes}分</strong>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      <div 
        className={`w-full h-18 bg-[#0a0a0b] border-x-0 flex items-center justify-between px-4 md:px-6 shrink-0 relative select-none
          ${position === 'top' ? 'border-b border-white/20 shadow-[0_4px_25px_rgba(0,0,0,0.55)]' : 'border-t border-white/20 shadow-[0_-4px_25px_rgba(0,0,0,0.55)]'}`}
        id={`phase-progress-nav-${position}`}
      >
        {/* 1. SESSION CLOCK MODULE */}
        <div 
          className="flex items-center gap-3 pr-4 border-r border-white/15 h-10 shrink-0"
        >
          <button
            onClick={!sessionStartTime ? onStartSession : () => onToggleTimer('')}
            className="w-8 h-8 rounded-full flex items-center justify-center border border-white/20 bg-white/10 text-white/80 hover:text-white hover:border-white/30 transition-all active:scale-95 cursor-pointer"
            style={sessionStartTime && !isPaused ? {
              borderColor: themeColor,
              backgroundColor: `${themeColor}22`,
              color: '#ffffff',
              boxShadow: `0 0 10px ${themeColor}33`
            } : undefined}
            title={!sessionStartTime ? "Start Session" : isPaused ? "Resume Session" : "Pause Session"}
          >
            {!sessionStartTime || isPaused ? (
              <svg className="w-3 h-3 ml-0.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            ) : (
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            )}
          </button>

          <div className="flex flex-col justify-center">
            <div className="text-[7px] font-black font-cinzel text-white/95 uppercase tracking-[0.2em] leading-none mb-1">
              {sessionStartTime ? 'Session RunTime' : 'System Ready'}
            </div>
            <span 
              className={`text-18 font-mono font-black tracking-tighter leading-none tabular-nums select-none ${
                !sessionStartTime 
                  ? 'text-white/85' 
                  : isPaused 
                    ? 'text-amber-500/85' 
                    : 'brightness-125'
              }`}
              style={{ color: sessionStartTime && !isPaused ? themeColor : undefined }}
            >
              {sessionStartTime ? formatTime((now - sessionStartTime) / 1000) : "00:00"}
            </span>
          </div>
        </div>

        {/* 2. NAVIGATION TRIGGERS & HORIZONTAL TRACK CONTAINER */}
        <div 
          className="flex-1 flex items-center overflow-hidden h-full relative mx-3 md:mx-4"
        >
          {/* Left Scroll shadow/trigger */}
          <button 
            onClick={() => handleScroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-12 flex items-center justify-start bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-transparent text-white/75 hover:text-white z-10 transition-colors cursor-pointer pl-1"
          >
            <ChevronLeft size={18} />
          </button>

          {/* The Track */}
          <div 
            ref={scrollRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUpOrLeave}
            onPointerLeave={handlePointerUpOrLeave}
            className="flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-smooth w-full h-full px-10 cursor-grab active:cursor-grabbing"
            style={{ touchAction: 'pan-x' }}
          >
            {phases.map((phase, index) => {
              const isActive = phase.id === activePhaseId;
              const isPreview = phase.id === previewPhaseId;
              const unlocked = isPhaseUnlocked(index);
              const isHighlighted = highlightedPhaseId === phase.id;

              // Timer specific details
              const timerId = phase.timers?.[0]?.id || '';
              const tState = timerStates[timerId];

              const totalSecs = phase.timeMinutes ? (phase.timeMinutes * 60) : (phase.timers?.[0]?.durationMinutes ? phase.timers[0].durationMinutes * 60 : 300);
              const runningSeconds = tState ? (
                tState.isRunning && tState.startTime
                  ? Math.max(0, tState.seconds - (now - tState.startTime) / 1000)
                  : tState.seconds
              ) : totalSecs;

              return (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  index={index}
                  isActive={isActive || isHighlighted}
                  isPreview={isPreview}
                  unlocked={unlocked}
                  themeColor={themeColor}
                  runningSeconds={runningSeconds}
                  timerState={tState}
                  onPreview={onPhasePreview}
                  onActivate={onPhaseTransition}
                  onToggleTimer={onToggleTimer}
                  onSetCompleted={onSetCompleted}
                  onOpenDetails={onOpenPhasePopup}
                  onResetTimer={onResetTimer}
                />
              );
            })}
          </div>

          {/* Right Scroll shadow/trigger */}
          <button 
            onClick={() => handleScroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-12 flex items-center justify-end bg-gradient-to-l from-zinc-950 via-zinc-950/90 to-transparent text-white/75 hover:text-white z-10 transition-colors cursor-pointer pr-1"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* 3. POPUP TRIGGERS MODULE */}
        <div className="pl-4 border-l border-white/15 h-10 flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPhasePopup}
            className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white/85 hover:text-white hover:border-white/30 transition-all font-cinzel font-black text-[9px] tracking-widest uppercase active:scale-95 cursor-pointer"
          >
            Details
          </button>
        </div>
      </div>

      {/* 4. HIGH-PRECISION PREVIEW BALLOON (FLOATING POPUP) */}
      <AnimatePresence key="preview-floating-balloon">
        {previewPhase && previewIndex !== -1 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: position === 'top' ? -15 : 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: position === 'top' ? -15 : 15 }}
            transition={{ type: 'spring', damping: 20, stiffness: 250 }}
            className={`absolute z-[55] w-64 md:w-72 bg-zinc-900/98 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-[0_15px_45px_rgba(0,0,0,0.9)] flex flex-col gap-4 select-none`}
            style={{
              left: `${phases.length > 1 ? 15 + (previewIndex / (phases.length - 1)) * 70 : 50}%`,
              transform: 'translateX(-50%)',
              ...(position === 'top' 
                ? { top: '100%', marginTop: '12px' } 
                : { bottom: '100%', marginBottom: '12px' }
              )
            }}
          >
            {/* 吹き出しの矢印（三角形） */}
            <div 
              className={`absolute w-3.5 h-3.5 bg-zinc-900 border-t border-l border-white/15 rotate-45 left-1/2 -translate-x-1/2`}
              style={position === 'top' 
                ? { top: '-8px' } 
                : { bottom: '-8px', transform: 'translateX(-50%) rotate(225deg)' }
              }
            />

            {/* ヘッダー・クローズボタン */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-[10px] font-black font-cinzel text-white/40 tracking-[0.2em] uppercase">Phase Breakdown</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onPhasePreview('');
                }}
                className="text-white/40 hover:text-white/80 hover:bg-white/10 transition-all text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/5 cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* 1. 全体目標 */}
            <div className="space-y-1">
              <div className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 font-sans flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: previewPhase.themeColor || themeColor, boxShadow: `0 0 8px ${previewPhase.themeColor || themeColor}` }} />
                予定時間
              </div>
              <div className="text-24 font-black font-mono tracking-tight flex items-baseline gap-2 text-white tabular-nums">
                <span>{formatMinutes(getPhaseTargetMin(previewPhase))}</span>
                <span className="text-white/15 font-medium text-xl">/</span>
                <span style={{ color: previewPhase.themeColor || themeColor }}>{formatTime(getPhaseRunningSecs(previewPhase))}</span>
              </div>
            </div>

            {/* 2. 各タイマーブレイクダウン */}
            {(previewPhase.timers || []).length > 0 && (
              <div className="flex flex-col gap-3.5 pt-3 border-t border-white/5">
                {(previewPhase.timers || []).map((t) => (
                  <div key={t.id} className="space-y-1">
                    <div className="text-[9px] uppercase font-bold tracking-widest text-zinc-400 font-sans pl-3.5 relative">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/10 rounded" />
                      {t.label}
                    </div>
                    <div className="text-18 font-black font-mono tracking-tight flex items-baseline gap-1.5 text-zinc-300 tabular-nums pl-3.5">
                      <span>{formatMinutes(t.durationMinutes)}</span>
                      <span className="text-white/10 font-medium text-base">/</span>
                      <span className="text-emerald-400">{formatTime(getTimerElapsedSecs(t))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. バッファ時間 */}
            {previewPhase.bufferDurationMinutes && previewPhase.bufferDurationMinutes > 0 ? (
              <div className="space-y-1 pt-3 border-t border-white/5 pl-3.5">
                <div className="text-[9px] uppercase font-bold tracking-widest text-amber-500/65 font-sans">
                  バッファ
                </div>
                <div className="text-18 font-black font-mono tracking-tight text-amber-300 tabular-nums">
                  {formatMinutes(previewPhase.bufferDurationMinutes)}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {position === 'top' && activePhase && (
        <AnimatePresence key="details-presence-top">
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full bg-zinc-950/95 backdrop-blur-md px-6 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-white/10 text-[10px] md:text-[11px] font-mono text-white/50 select-none tracking-wider overflow-hidden shrink-0 shadow-[0_4px_15px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse`}
                style={{ backgroundColor: activePhase.themeColor || themeColor, boxShadow: `0 0 6px ${activePhase.themeColor || themeColor}` }}
              />
              <span className="text-white/30 font-black font-cinzel">PHASE INFO &gt;&gt;</span>
              <span className="font-bold text-white uppercase font-sans">[{activePhase.name}]</span>
              {activePhase.description && (
                <span className="text-white/40 truncate max-w-[200px] font-sans">({activePhase.description})</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-white/30 font-black font-cinzel">TARGET GOAL:</span>
                <span className="font-black text-sky-400 text-xs tracking-tight bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
                  {getPhaseTargetMin(activePhase)}分
                </span>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-white/30 font-black font-cinzel">BREAKDOWN:</span>
              <div className="flex items-center flex-wrap gap-1">
                {(activePhase.timers || []).length > 0 ? (
                  (activePhase.timers || []).map((t, i) => (
                    <span key={t.id} className="bg-white/5 text-white/70 px-1.5 py-0.5 rounded border border-white/5 text-[9px] flex items-center gap-1">
                      <span className="text-white/40 font-bold">{i + 1}.</span> {t.label}: <strong className="text-white font-black">{t.durationMinutes}分</strong>
                    </span>
                  ))
                ) : (
                  <span className="text-white/20 italic text-[9px]">タイマーなし</span>
                )}
                {(activePhase.bufferDurationMinutes || 0) > 0 && (
                  <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 text-[9px] font-bold">
                    バッファ: <strong className="text-amber-200 font-black">{activePhase.bufferDurationMinutes}分</strong>
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
});

export default PhaseProgressNav;
