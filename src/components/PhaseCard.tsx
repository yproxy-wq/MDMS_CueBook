import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Check, Lock, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Phase } from '../types';
import { ConfettiEffect } from './ConfettiEffect';
import { useDisplayNow } from '../hooks/useDisplayNow';

interface PhaseCardProps {
  phase: Phase;
  index: number;
  isActive: boolean;
  isPreview: boolean;
  unlocked: boolean;
  themeColor: string;
  runningSeconds: number;
  timerState?: {
    seconds: number;
    isRunning: boolean;
    startTime?: number | null;
  };
  onPreview: (id: string) => void;
  onActivate: (id: string) => void;
  onToggleTimer: (id: string) => void;
  onSetCompleted: (id: string, completed: boolean) => void;
  onOpenDetails: () => void;
  onResetTimer?: (id: string) => void;
}

export const PhaseCard: React.FC<PhaseCardProps> = React.memo(({
  phase,
  isActive,
  isPreview,
  unlocked,
  themeColor,
  runningSeconds,
  timerState,
  onPreview,
  onActivate,
  onToggleTimer,
  onSetCompleted,
  onOpenDetails,
  onResetTimer,
}) => {
  const now = useDisplayNow(250);
  const phaseColor = phase.themeColor || themeColor;
  const displayedSeconds = timerState?.isRunning && timerState.startTime
    ? Math.max(0, timerState.seconds - (now - timerState.startTime) / 1000)
    : runningSeconds;
  
  // Quick control overlay state: 'none' | 'play' | 'pause' | 'paused-options'
  const [overlayMode, setOverlayMode] = useState<'none' | 'play' | 'pause' | 'paused-options'>('none');
  const [resetClicked, setResetClicked] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastClickRef = useRef<{ time: number }>({ time: 0 });

  // Confetti celebration state triggers on isCompleted: false -> true
  const [isCelebrated, setIsCelebrated] = useState(false);
  const prevCompletedRef = useRef(phase.isCompleted);

  useEffect(() => {
    let animId: number;
    let timer: NodeJS.Timeout;

    if (!prevCompletedRef.current && phase.isCompleted) {
      animId = requestAnimationFrame(() => {
        setIsCelebrated(true);
      });
      timer = setTimeout(() => {
        animId = requestAnimationFrame(() => {
          setIsCelebrated(false);
        });
      }, 1600);
    }
    prevCompletedRef.current = phase.isCompleted;

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (timer) clearTimeout(timer);
    };
  }, [phase.isCompleted]);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  // Reset confirmation state when overlay is closed
  useEffect(() => {
    if (overlayMode === 'none') {
      const handle = requestAnimationFrame(() => {
        setResetClicked(false);
      });
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      return () => cancelAnimationFrame(handle);
    }
  }, [overlayMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (!unlocked) return;
    
    const clickTime = e.timeStamp;
    const lastClick = lastClickRef.current;
    
    // Switch preview/active layout representation first
    onPreview(phase.id);

    // Double-click/double-tap detection to open details (Double-tap in 300ms)
    if (clickTime - lastClick.time < 300) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setOverlayMode('none');
      onOpenDetails();
      lastClickRef.current = { time: 0 };
      return;
    }
    
    lastClickRef.current = { time: clickTime };

    // Overlay trigger or action execution on single click
    if (overlayMode !== 'none') {
      // If clicking inside active options, don't close immediately (handled by specific buttons)
      return;
    }

    // Determine the overlay mode to show based on the current timer state
    const isRunning = timerState?.isRunning ?? false;

    if (isRunning) {
      // If currently running, single tap shows the big Pause button
      setOverlayMode('pause');
    } else {
      // Show 3-button options (Reset, Play, Complete)
      setOverlayMode('paused-options');
    }

    // Set auto-fade timeout (increased slightly to allow secure double tap on reset if needed)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setOverlayMode('none');
    }, 2500);
  };

  const handlePlayAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setOverlayMode('none');
    
    if (!isActive) {
      // Transition phase and then toggle the timer
      onActivate(phase.id);
    } else {
      // Just toggle the timer
      onToggleTimer(phase.id);
    }
  };

  const handlePauseAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setOverlayMode('none');
    
    onToggleTimer(phase.id);
  };

  const handleCompleteAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setOverlayMode('none');
    
    onSetCompleted(phase.id, !phase.isCompleted);
  };

  const handleResetAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent overlay auto-close during interaction
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setOverlayMode('none');
      }, 3500);
    }

    if (!resetClicked) {
      setResetClicked(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setResetClicked(false);
      }, 2000); // Reset validation timeout
    } else {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
      setResetClicked(false);
      setOverlayMode('none');
      onResetTimer?.(phase.id);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`px-2.5 md:px-3 rounded-xl border flex flex-col justify-center min-w-[115px] md:min-w-[135px] shrink-0 select-none relative overflow-hidden group h-11 transition-all duration-300 cursor-pointer active:scale-95
        ${!unlocked 
          ? 'bg-black/70 border-white/10 opacity-60 cursor-not-allowed text-white/40' 
          : isActive 
            ? 'bg-[var(--phase-color-bg-hover)] border-[var(--phase-color)] text-white shadow-[0_0_15px_var(--phase-color-glow)]' 
            : isPreview 
              ? 'bg-[var(--phase-color-bg)] border-[var(--phase-color-hover)] text-white hover:bg-[var(--phase-color-bg-hover)] hover:border-[var(--phase-color)]' 
              : 'bg-[#15151e]/90 border-[var(--phase-color-border-dim)] text-white/85 hover:text-white hover:border-[var(--phase-color-hover)] hover:bg-[var(--phase-color-bg)]'
        }`}
      style={{
        '--phase-color': phaseColor,
        '--phase-color-hover': `${phaseColor}aa`,
        '--phase-color-border-dim': `${phaseColor}30`,
        '--phase-color-bg': `${phaseColor}10`,
        '--phase-color-bg-hover': `${phaseColor}22`,
        '--phase-color-glow': `${phaseColor}33`,
      } as React.CSSProperties}
    >
      {/* Celebration Sparkles */}
      <ConfettiEffect active={isCelebrated} color={phaseColor} />

      {/* Completed indicator */}
      {unlocked && phase.isCompleted && overlayMode !== 'paused-options' && (
        <div className="absolute top-1 right-1 z-10">
          <CheckCircle2 size={9} className="text-emerald-400 fill-emerald-500/10" />
        </div>
      )}

      {/* Main Card Content */}
      <div className="flex items-center gap-1.5 mb-1 z-0">
        {!unlocked ? (
          <Lock size={9} className="text-white/40 shrink-0" />
        ) : isActive ? (
          <div 
            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: phaseColor, boxShadow: `0 0 8px ${phaseColor}` }}
          />
        ) : isPreview ? (
          <Eye size={9} className="text-white/80 shrink-0 animate-pulse" />
        ) : unlocked ? (
          <div 
            className="w-1.5 h-1.5 rounded-full shrink-0 opacity-45 transition-all group-hover:opacity-100 group-hover:scale-110"
            style={{ backgroundColor: phaseColor }}
          />
        ) : null}

        <span 
          className="text-[11px] md:text-[12px] font-black tracking-wider truncate uppercase font-cinzel leading-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] transition-all duration-300"
          style={{ 
            textShadow: unlocked && isActive
              ? `0 0 12px ${phaseColor}, 0 0 4px ${phaseColor}` 
              : '0 0 8px rgba(255,255,255,0.45)',
            color: unlocked && isActive ? phaseColor : '#ffffff'
          }}
        >
          {phase.name}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] md:text-[11px] leading-none font-mono mt-0.5 z-0">
        <span className="text-[7.5px] tracking-widest text-white/90 font-black uppercase font-cinzel">TIMER</span>
        <div className="flex items-center gap-1">
          <span 
            className="font-black tracking-tight font-mono select-none text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
            style={{ color: unlocked && isActive ? phaseColor : '#ffffff' }}
          >
            {formatTime(displayedSeconds)}
          </span>
          
        </div>
      </div>

      {/* Interactive Overlay Overlay (AnimatePresence) */}
      <AnimatePresence>
        {overlayMode !== 'none' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-20"
          >
            {overlayMode === 'pause' && (
              <button 
                onClick={handlePauseAction}
                className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 hover:bg-amber-500/45 hover:scale-110 active:scale-95 transition-all flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              >
                <Pause size={14} fill="currentColor" />
              </button>
            )}

            {overlayMode === 'paused-options' && (
              <div className="flex items-center gap-1.5 md:gap-2">
                {/* Reset (Double click protection) */}
                <button 
                  onClick={handleResetAction}
                  className={`w-7 h-7 rounded-full transition-all duration-200 flex flex-col items-center justify-center hover:scale-115 active:scale-90
                    ${resetClicked 
                      ? 'bg-red-500 border border-red-400 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse' 
                      : 'bg-amber-500/20 border border-amber-400/80 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                    }`}
                  title={resetClicked ? "もう一度押して確定" : "タイマーリセット"}
                >
                  {resetClicked ? (
                    <span className="text-[7px] md:text-[7.5px] font-black leading-none tracking-tight">TAP!</span>
                  ) : (
                    <RotateCcw size={11} className="stroke-[2.5px]" />
                  )}
                </button>

                {/* Resume / Start */}
                <button 
                  onClick={handlePlayAction}
                  className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/80 text-emerald-300 hover:bg-emerald-500/35 hover:scale-115 active:scale-90 transition-all flex items-center justify-center shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                  title="タイマー開始"
                >
                  <Play size={11} fill="currentColor" className="ml-0.5" />
                </button>

                {/* Toggle Complete */}
                <button 
                  onClick={handleCompleteAction}
                  className={`w-7 h-7 rounded-full transition-all flex items-center justify-center hover:scale-115 active:scale-90
                    ${phase.isCompleted 
                      ? 'bg-rose-500/20 border border-rose-400/80 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.2)]' 
                      : 'bg-blue-500/20 border border-blue-400/80 text-blue-300 shadow-[0_0_8px_rgba(59,130,246,0.2)]'
                    }`}
                  title={phase.isCompleted ? "未完了にする" : "完了にする"}
                >
                  <Check size={11} className={phase.isCompleted ? "stroke-[3px]" : ""} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default PhaseCard;
