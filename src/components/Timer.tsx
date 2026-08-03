import React, { useState, useEffect, useMemo } from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, ChevronLeft, ChevronRight, Settings, X, Minimize2, Clock as TimerIcon } from 'lucide-react';
import { TimerConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import HoldButton from './HoldButton';
import { formatMinutesSeconds, isWarningTime } from '../utils/functionalHelper';
import { audioService } from '../services/AudioService';

interface TimerProps {
  config: TimerConfig;
  seconds: number;
  isRunning: boolean;
  themeColor: string;
  totalTimers?: number;
  activeTimerIndex?: number;
  onToggle: () => void;
  onReset: () => void;
  onAdjust: (delta: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  isCollapsed?: boolean;
  isLoggedIn?: boolean;
  onShare?: () => string;
  startTime?: number | null;
  isDocked?: boolean;
  imageUrl?: string | null;
  resourceType?: 'image' | 'pdf' | null;
  pdfPage?: number | null;
  onOpenSyncModal?: () => void;
  timerFlashOnPauseEnabled?: boolean;
  onSetDocked?: (docked: boolean) => void;
  timerLabelText?: string;
}

const TimerCard: React.FC<TimerProps> = ({ 
  config, seconds, isRunning, themeColor, 
  totalTimers = 1, activeTimerIndex = 0, onToggle, onReset, onAdjust, onPrev, onNext,
  isCollapsed = false, startTime, isDocked = false,
  imageUrl = null, resourceType = null, pdfPage = null, onOpenSyncModal,
  timerFlashOnPauseEnabled = false, onSetDocked, timerLabelText
}) => {
  const [displaySeconds, setDisplaySeconds] = useState(seconds);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isSyncingFlash, setIsSyncingFlash] = useState(false);
  const [isFlashActive, setIsFlashActive] = useState(false);
  const isInitialMount = React.useRef(true);
  const [isTouchDevice] = useState(() => 
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const triggeredLaps = React.useRef<Set<number>>(new Set());
  const [activeLapHighlight, setActiveLapHighlight] = useState<number | null>(null);

  const lapTimes = config.lapTimes;

  // Re-evaluation function
  const reevaluateLaps = React.useCallback((currentSeconds: number) => {
    triggeredLaps.current.clear();
    if (lapTimes) {
      lapTimes.forEach((lap) => {
        // If current remaining time is already past this lap time, mark it as triggered
        if (currentSeconds < lap * 60) {
          triggeredLaps.current.add(lap);
        }
      });
    }
  }, [lapTimes]);

  // Re-evaluate on initial mount, reset, adjust, or configuration change
  useEffect(() => {
    reevaluateLaps(seconds);
  }, [seconds, lapTimes, reevaluateLaps]);

  const checkLapTriggers = React.useCallback((currentSeconds: number) => {
    if (!lapTimes) return;
    lapTimes.forEach((lap) => {
      const lapSeconds = lap * 60;
      // Trigger if remaining time has ticked down past this lap threshold, and we haven't fired it yet
      if (currentSeconds > 0 && currentSeconds <= lapSeconds && !triggeredLaps.current.has(lap)) {
        triggeredLaps.current.add(lap);
        
        // Play high-fidelity double-tone crystal chime
        try {
          audioService.playLapChime();
        } catch (e) {
          console.warn('Lap chime failed:', e);
        }
        
        // Display beautiful high-contrast broadcast overlay for 8 seconds
        setActiveLapHighlight(lap);
        setTimeout(() => {
          setActiveLapHighlight(prev => prev === lap ? null : prev);
        }, 8000);
      }
    });
  }, [lapTimes]);

  useEffect(() => {
    if (!timerFlashOnPauseEnabled) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsFlashActive(true);
    const timer = setTimeout(() => setIsFlashActive(false), 800);
    return () => clearTimeout(timer);
  }, [isRunning, timerFlashOnPauseEnabled]);

  useEffect(() => {
    if (!isRunning || !startTime) {
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remains = Math.max(0, seconds - elapsed);
      const newSeconds = Math.ceil(remains);
      
      checkLapTriggers(remains);
      
      setDisplaySeconds((prev) => (prev !== newSeconds ? newSeconds : prev));
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [isRunning, startTime, seconds, checkLapTriggers]);

  const effectiveSeconds = isRunning && startTime ? displaySeconds : seconds;

  const isWarning = isWarningTime(effectiveSeconds);

  const triggerSyncFlash = () => {
    setIsSyncingFlash(true);
    const timer = setTimeout(() => setIsSyncingFlash(false), 1200);
    return () => clearTimeout(timer);
  };

  const handleToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerSyncFlash();
    onToggle();
  };

  const handleReset = () => {
    triggerSyncFlash();
    onReset();
  };

  const handleAdjust = (delta: number) => {
    triggerSyncFlash();
    onAdjust(delta);
  };

  const isUrgent = isRunning && isWarning;
  const isCritical = isRunning && effectiveSeconds < 30 && effectiveSeconds > 0;
  const isPaused = !isRunning && effectiveSeconds > 0;

  const shakeIntensity = isUrgent 
    ? Math.max(0, Math.min(6, (60 - effectiveSeconds) / 10))
    : 0;

  const urgencyDuration = isUrgent
    ? `${Math.max(0.12, 0.12 + (effectiveSeconds / 60) * 1.38)}s`
    : '1s';

  const animationName = isCritical ? 'critical-pulse' : 'urgency-pulse';

  const urgencyStyle = isUrgent ? {
    display: 'inline-block',
    animation: `${animationName} var(--urgency-duration) infinite ease-in-out, urgency-shake var(--urgency-duration) infinite ease-in-out`,
    '--urgency-duration': urgencyDuration,
    '--shake-intensity': `${shakeIntensity}px`
  } as React.CSSProperties : {};

  // UNIX Philosophy (Single Responsibility) & ACID Principles (Consistency & Isolation):
  // We extract and isolate style and class generation logic to ensure a pure, predictable,
  // and high-performance mapping from state to styling with zero nested side-effects.
  const collapsedVisuals = useMemo(() => {
    if (!isCollapsed) return null;

    let className = 'w-full bg-black/95 backdrop-blur-2xl border transition-all duration-300 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3 animate-in fade-in slide-in-from-right-2 duration-300 relative';
    let style: React.CSSProperties = {
      transition: 'all 0.5s ease-in-out',
    };

    if (activeLapHighlight !== null) {
      style = {
        borderColor: '#38bdf8',
        boxShadow: '0 0 25px rgba(56,189,248,0.45)',
        backgroundColor: 'rgba(56,189,248,0.05)',
        transform: 'scale(1.02)',
        transition: 'all 0.3s ease-out',
      };
    } else if (isFlashActive) {
      style = {
        borderColor: themeColor,
        boxShadow: `0 0 25px ${themeColor}60`,
        backgroundColor: `${themeColor}15`,
        transform: 'scale(1.03)',
        transition: 'all 0.2s ease-out',
      };
    } else if (isUrgent) {
      className += ' border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-[pulse_2.5s_infinite_ease-in-out]';
      style = {
        borderColor: `${themeColor}aa`,
        boxShadow: `0 0 20px ${themeColor}30`,
        backgroundColor: `${themeColor}05`,
        transition: 'all 0.5s ease-in-out',
      };
    } else if (isPaused) {
      className += ' border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-[pulse_3s_infinite_ease-in-out]';
    } else {
      className += ' border-white/20';
    }

    return { className, style };
  }, [isCollapsed, isFlashActive, isUrgent, isPaused, themeColor, activeLapHighlight]);

  const standardVisuals = useMemo(() => {
    if (isCollapsed) return null;

    let className = 'w-full flex flex-col group/timer transition-all duration-500 relative shrink-0 ';
    let style: React.CSSProperties = {
      transition: 'all 0.5s ease-in-out',
    };

    if (isDocked) {
      className += 'py-3 pb-3 px-3 bg-black/60 rounded-2xl border transition-colors min-h-[162px] ';
      if (isFlashActive) {
        // Handled via style
      } else if (isUrgent) {
        className += 'animate-[pulse_2.5s_infinite_ease-in-out]';
      } else if (isPaused) {
        className += 'border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-[pulse_3s_infinite_ease-in-out]';
      } else {
        className += 'border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.4)]';
      }
    } else {
      className += 'py-4 rounded-2xl border transition-colors ';
      if (isFlashActive) {
        className += 'border-transparent';
      } else if (isUrgent) {
        className += 'animate-[pulse_2.5s_infinite_ease-in-out]';
      } else {
        className += 'border-transparent';
      }
    }

    if (activeLapHighlight !== null) {
      style = {
        borderColor: '#38bdf8',
        boxShadow: '0 0 35px rgba(56,189,248,0.4)',
        backgroundColor: 'rgba(56,189,248,0.05)',
        transform: 'scale(1.01)',
        transition: 'all 0.4s ease-out',
      };
    } else if (isFlashActive) {
      style = {
        borderColor: themeColor,
        boxShadow: `0 0 30px ${themeColor}60`,
        backgroundColor: `${themeColor}15`,
        transform: 'scale(1.02)',
        transition: 'all 0.2s ease-out',
      };
    } else if (isUrgent) {
      style = {
        borderColor: `${themeColor}80`,
        boxShadow: `0 0 25px ${themeColor}25`,
        backgroundColor: `${themeColor}05`,
        transition: 'all 0.5s ease-in-out',
      };
    }

    return { className, style };
  }, [isCollapsed, isDocked, isFlashActive, isUrgent, isPaused, themeColor, activeLapHighlight]);

  if (isCollapsed && collapsedVisuals) {
    return (
      <div 
        className={collapsedVisuals.className}
        style={collapsedVisuals.style}
      >
        <div className="flex items-center justify-between w-full border-b border-white/10 pb-2">
           <span className="text-[9px] font-bold font-cinzel text-white/70 uppercase tracking-widest truncate max-w-[100px]">{timerLabelText || config.label}</span>
           <TimerIcon size={10} className={isRunning ? 'animate-pulse' : isPaused ? 'text-amber-500 animate-pulse' : 'opacity-20'} style={{ color: isRunning ? themeColor : undefined }} />
        </div>
        <div className="relative w-full flex flex-col items-center justify-center">
          <div 
            className={`text-4xl font-mono font-black tabular-nums tracking-tighter leading-none transition-colors duration-300 ${isWarning ? 'text-red-500' : 'text-white'}`}
            style={{ 
              color: !isWarning && isRunning ? themeColor : undefined,
              ...urgencyStyle
            }}
          >
            {formatMinutesSeconds(effectiveSeconds)}
          </div>
          <AnimatePresence>
            {activeLapHighlight !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute inset-0 flex items-center justify-center bg-sky-500 text-black text-[10px] font-black tracking-widest uppercase rounded-lg font-mono z-[600] shadow-[0_0_15px_rgba(56,189,248,0.6)] px-2 text-center"
              >
                {(() => {
                  const individualText = activeLapHighlight !== null ? config.lapTexts?.[activeLapHighlight] : null;
                  if (individualText) return individualText;
                  return config.lapNotificationText ? config.lapNotificationText : `残り ${activeLapHighlight} 分`;
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={handleToggle} className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90" style={{ color: isRunning ? themeColor : undefined }}>
              {isRunning ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
           </button>
           <HoldButton onHoldComplete={handleReset} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-white/20 hover:text-red-500 transition-all active:scale-90" title="Hold to Reset">
              <RotateCcw size={14} />
           </HoldButton>
        </div>
      </div>
    );
  }

  const hasPrev = activeTimerIndex > 0;
  const hasNext = activeTimerIndex < totalTimers - 1;

  const handleContainerClick = () => {
    if (isTouchDevice && !showOverlay) {
      setShowOverlay(true);
    }
  };

  return (
    <div 
      className={standardVisuals?.className || ''}
      style={standardVisuals?.style}
      onMouseEnter={() => !isTouchDevice && setShowOverlay(true)}
      onMouseLeave={() => !isTouchDevice && setShowOverlay(false)}
      onClick={handleContainerClick}
    >
      {/* Background Image / PDF Preview layer for docked state */}
      {isDocked && (
        <div className="absolute inset-x-0.5 top-0.5 bottom-0.5 bg-black pointer-events-none rounded-2xl overflow-hidden z-0">
          {imageUrl ? (
            resourceType === 'pdf' ? (
              <div className="w-full h-full bg-neutral-900/90 flex items-center justify-center">
                <div className="flex flex-col items-center gap-1 opacity-20">
                  <span className="text-[12px] font-bold text-white uppercase tracking-widest">PDF: P{pdfPage}</span>
                </div>
              </div>
            ) : (
              <img 
                src={imageUrl} 
                className="w-full h-full object-cover opacity-40" 
                alt="Timer Background Preview" 
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="w-full h-full opacity-5 blur-xl" style={{ backgroundColor: themeColor }} />
          )}
          {/* Subtle gradient overlay to keep timer digit visibility flawless */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/65" />
        </div>
      )}

      <div className="flex flex-col items-center justify-center w-full px-4 relative z-10">
        {/* Label on top with navigation */}
        <div className={`flex items-center justify-between ${isDocked ? 'mb-2 px-3' : 'justify-center mb-2 px-2'} h-5 w-full`}>
           {isDocked ? (
             <>
               {/* Left Side: Navigation Controls + Status Indicator */}
               <div className="flex items-center gap-2 overflow-hidden pl-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isRunning ? 'animate-pulse' : 'bg-white/10'}`} style={{ backgroundColor: isRunning ? themeColor : undefined, boxShadow: isRunning ? `0 0 10px ${themeColor}` : 'none' }} />
                 {totalTimers > 1 && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onPrev?.(); }} 
                     disabled={!hasPrev}
                     className={`transition-all ${hasPrev ? 'text-white/40 hover:text-white' : 'text-white/5 cursor-not-allowed'} shrink-0`}
                   >
                     <ChevronLeft size={12} strokeWidth={3} className="text-white/80" />
                   </button>
                 )}
                 <span className="text-[9px] font-bold font-sans text-white/80 truncate max-w-[85px] uppercase tracking-[0.1em]">
                   {timerLabelText || config.label}
                 </span>
                 {totalTimers > 1 && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onNext?.(); }} 
                     disabled={!hasNext}
                     className={`transition-all ${hasNext ? 'text-white/70 hover:text-white' : 'text-white/20 cursor-not-allowed'} shrink-0`}
                   >
                     <ChevronRight size={12} strokeWidth={3} className="text-white/85" />
                   </button>
                 )}
               </div>

               {/* Right Side: SYNCING Tag & Sync Modal Button */}
               <div className="flex items-center gap-1.5 shrink-0 pr-1.5">
                  {!isRunning && effectiveSeconds > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[6px] font-black tracking-widest font-sans animate-pulse">
                      <span className="w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_4px_#f59e0b]" />
                      Paused...
                    </span>
                  )}
                  <span 
                    className={`px-1.5 py-0.5 rounded transition-all duration-300 font-black tracking-widest font-sans text-[6px] ${
                      isSyncingFlash 
                        ? 'bg-sky-450 text-white shadow-[0_0_15px_rgba(56,189,248,0.8)] border border-sky-400 scale-105' 
                        : 'bg-sky-500/10 border border-sky-500/30 text-sky-400'
                    }`}
                  >
                    {isSyncingFlash ? 'SYNC UPDATED' : 'SYNCING'}
                  </span>
                </div>
             </>
           ) : (
             <>
               {totalTimers > 1 && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); onPrev?.(); }} 
                   disabled={!hasPrev}
                   className={`transition-all ${hasPrev ? 'text-white/40 hover:text-white' : 'text-white/5 cursor-not-allowed'} shrink-0`}
                 >
                   <ChevronLeft size={14} strokeWidth={3} className="text-white/80" />
                 </button>
               )}

               <div className="flex items-center gap-3 pl-1.5">
                 <div 
                   className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                     isRunning 
                       ? 'animate-pulse' 
                       : effectiveSeconds > 0 
                         ? 'animate-[ping_1.5s_infinite_ease-in-out]' 
                         : 'bg-white/10'
                   }`} 
                   style={{ 
                     backgroundColor: isRunning 
                       ? themeColor 
                       : effectiveSeconds > 0 
                         ? '#f59e0b' 
                         : undefined, 
                     boxShadow: isRunning 
                       ? `0 0 10px ${themeColor}` 
                       : effectiveSeconds > 0 
                         ? '0 0 10px #f59e0b' 
                         : 'none' 
                   }} 
                 />
                 <span className="text-[10px] font-bold font-sans text-white/85 truncate max-w-[175px] uppercase tracking-[0.2em]">
                   {timerLabelText || config.label}
                 </span>
               </div>

               {totalTimers > 1 && (
                 <button 
                   onClick={(e) => { e.stopPropagation(); onNext?.(); }} 
                   disabled={!hasNext}
                   className={`transition-all ${hasNext ? 'text-white/70 hover:text-white' : 'text-white/20 cursor-not-allowed'} shrink-0`}
                 >
                   <ChevronRight size={14} strokeWidth={3} className="text-white/85" />
                 </button>
               )}
             </>
           )}
        </div>

         <div className="flex items-center justify-center w-full group/time-container">
           <div className="relative isolate w-fit">
              <AnimatePresence>
                {activeLapHighlight !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    className="absolute -top-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-sky-500 text-black text-[9px] font-black tracking-widest uppercase rounded-full shadow-[0_0_15px_#38bdf8] flex items-center gap-1 font-mono whitespace-nowrap z-[600]"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                    {(() => {
                      const individualText = activeLapHighlight !== null ? config.lapTexts?.[activeLapHighlight] : null;
                      if (individualText) return individualText;
                      return config.lapNotificationText ? config.lapNotificationText : `残り ${activeLapHighlight} 分`;
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
             <div 
               className={`${isDocked ? 'text-[76px] lg:text-[84px]' : 'text-[56px] md:text-[64px]'} font-mono font-black tabular-nums tracking-[-0.07em] leading-none transition-all duration-700 select-none ${isWarning && isRunning ? 'text-red-500 scale-102 origin-center' : 'text-white/95'}`}
               style={{ 
                 color: !isWarning && isRunning ? themeColor : undefined,
                 textShadow: isRunning ? `0 0 35px ${themeColor}20` : 'none', ...urgencyStyle
               }}
             >
               {formatMinutesSeconds(effectiveSeconds)}
             </div>
            
             <AnimatePresence>
               {showOverlay && (
                 <motion.div 
                   key="overlay"
                   initial={{ opacity: 0, backdropFilter: 'blur(0px)', scale: 0.95 }}
                   animate={{ opacity: 1, backdropFilter: 'blur(2px)', scale: 1 }}
                   exit={{ opacity: 0, backdropFilter: 'blur(0px)', scale: 0.95 }}
                   className="absolute inset-[-8px] flex items-center justify-center bg-black/40 rounded-2xl border border-white/10 z-10 overflow-hidden"
                 >
                   <motion.button 
                     whileHover={{ scale: 1.1 }}
                     whileTap={{ scale: 0.9 }}
                     onClick={(e) => {
                       e.stopPropagation();
                       handleToggle();
                       if (isTouchDevice) setShowOverlay(false);
                     }}
                     className="p-3.5 rounded-full bg-white/10 border border-white/20 shadow-2xl flex items-center justify-center group/btn"
                   >
                     {isRunning ? (
                       <Pause size={28} className="text-white fill-white transition-transform group-hover/btn:scale-110" />
                     ) : (
                       <Play size={28} className="text-white fill-white translate-x-0.5 transition-transform group-hover/btn:scale-110" />
                     )}
                   </motion.button>
                  
                   {isTouchDevice && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); setShowOverlay(false); }}
                       className="absolute top-2 right-2 p-2 text-white/30 hover:text-white"
                     >
                       <X size={20} />
                     </button>
                    )}
                 </motion.div>
               )}
             </AnimatePresence>

             {/* FLOATING CONTROLS POPOVER */}
             <div className={`absolute top-full left-1/2 -translate-x-1/2 ${isDocked ? 'mt-0.5' : 'mt-2'} transition-all duration-300 z-[500] flex items-center gap-1 p-1 bg-[#121212] border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl min-w-fit whitespace-nowrap ${
                showOverlay 
                  ? 'opacity-100 visible scale-100' 
                  : 'opacity-0 invisible scale-90 group-hover/timer:opacity-100 group-hover/timer:visible group-hover/timer:scale-100'
              }`}>
                {!isDocked && onSetDocked ? (
                  <>
                    <button 
                       onClick={(e) => { e.stopPropagation(); onSetDocked(true); }} 
                       className="flex flex-col items-center justify-center w-10 h-10 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all" 
                       title="定位置に戻す"
                    >
                       <Minimize2 size={14} />
                       <span className="text-[7px] font-bold">DOCK</span>
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                  </>
                ) : onOpenSyncModal ? (
                  <>
                    <button 
                       onClick={(e) => { e.stopPropagation(); onOpenSyncModal(); }} 
                       className="flex flex-col items-center justify-center w-10 h-10 text-sky-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all" 
                       title="Sync Settings"
                    >
                       <Settings size={14} />
                       <span className="text-[7px] font-bold font-cinzel">SYNC</span>
                    </button>
                    <div className="w-px h-6 bg-white/10" />
                  </>
                ) : null}
                <button 
                   onClick={(e) => { e.stopPropagation(); handleAdjust(-60); }} 
                   className="flex flex-col items-center justify-center w-10 h-10 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                   title="-1min"
                >
                   <Minus size={14} />
                   <span className="text-[7px] font-bold">1 m</span>
                </button>
                <div className="w-px h-6 bg-white/10" />
                <HoldButton 
                   onHoldComplete={handleReset} 
                   className="flex flex-col items-center justify-center w-12 h-10 text-red-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg" 
                   title="Press and hold to RESET"
                >
                   <RotateCcw size={14} />
                   <span className="text-[6px] font-black font-sans tracking-wide">RESET</span>
                </HoldButton>
                <div className="w-px h-6 bg-white/10" />
                <button 
                   onClick={(e) => { e.stopPropagation(); handleAdjust(60); }} 
                   className="flex flex-col items-center justify-center w-10 h-10 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                   title="+1min"
                >
                   <Plus size={14} />
                   <span className="text-[7px] font-bold">1 m</span>
                </button>
             </div>
           </div>
         </div>
       </div>
      
       {isWarning && isRunning && (
         <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
       )}

    </div>
  );
};

export default TimerCard;
