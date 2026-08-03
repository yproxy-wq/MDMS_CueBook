
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Unlock, Lock, Eye, CheckCircle2 } from 'lucide-react';
import { Scenario } from '../types';
import TimePickerModal from './TimePickerModal';
import { ConfettiEffect } from './ConfettiEffect';
import { useDisplayNow } from '../hooks/useDisplayNow';

interface PhaseSidebarProps {
  scenario: Scenario;
  activePhaseId: string;
  previewPhaseId: string;
  themeColor: string;
  onPhasePreview: (id: string) => void;
  onPhaseTransition: (id: string) => void;
  onStopPhase: (id: string) => void;
  onCancelPhase: () => void;
  sessionStartTime?: number;
  exitTime?: string;
  onExitTimeChange: (time: string) => void;
  isPaused: boolean;
  phaseResults: Record<string, number>;
  activePhaseStartTime?: number;
  onStartSession: () => void;
  onTogglePause: () => void;
  isCollapsed: boolean;
}

const PhaseSidebar: React.FC<PhaseSidebarProps> = React.memo(({ 
  scenario, activePhaseId, previewPhaseId, themeColor, onPhasePreview, 
  onPhaseTransition, onStopPhase, onCancelPhase, sessionStartTime, 
  exitTime, onExitTimeChange, isPaused, phaseResults, 
  activePhaseStartTime, onStartSession, onTogglePause, isCollapsed
}) => {
  const now = useDisplayNow(1000);
  const [showExitTimePicker, setShowExitTimePicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [celebratingPhaseId, setCelebratingPhaseId] = useState<string | null>(null);
  const prevCompletedPhasesRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let animId: number;
    let timer: NodeJS.Timeout;

    const prev = prevCompletedPhasesRef.current;
    const current: Record<string, boolean> = {};
    let newlyCompletedId: string | null = null;

    (scenario.phases || []).forEach(phase => {
      current[phase.id] = !!phase.isCompleted;
      if (phase.isCompleted && !prev[phase.id]) {
        newlyCompletedId = phase.id;
      }
    });

    if (newlyCompletedId) {
      const targetId = newlyCompletedId;
      animId = requestAnimationFrame(() => {
        setCelebratingPhaseId(targetId);
      });
      timer = setTimeout(() => {
        animId = requestAnimationFrame(() => {
          setCelebratingPhaseId(null);
        });
      }, 1600);
    }

    prevCompletedPhasesRef.current = current;

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (timer) clearTimeout(timer);
    };
  }, [scenario.phases]);

  useEffect(() => {
    const autoScrollEnabled = scenario.phaseAutoScrollEnabled !== false;
    if (autoScrollEnabled && activePhaseId && containerRef.current) {
      const activeElement = containerRef.current.querySelector(`#phase-card-${activePhaseId}`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [activePhaseId, scenario.phaseAutoScrollEnabled]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getPhaseActualSeconds = (phaseId: string) => {
    if (phaseId === activePhaseId && activePhaseStartTime) {
      return Math.floor((now - activePhaseStartTime) / 1000);
    }
    return phaseResults[phaseId] || 0;
  };

  const isPhaseUnlocked = (index: number) => {
    const phases = scenario.phases || [];
    const phase = phases[index];
    if (!phase || !phase.isLockedByPrevious || index === 0) return true;
    const prevPhase = phases[index - 1];
    if (!prevPhase) return true;
    const results = prevPhase.checklistResults || [];
    const isChecklistComplete = prevPhase.checklists && prevPhase.checklists.length > 0 && prevPhase.checklists.every((_, i) => results[i] === true);
    return isChecklistComplete && prevPhase.isCompleted;
  };

  const handlePhaseItemClick = (id: string) => {
    onPhasePreview(id);
  };

  const handlePhaseStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onPhaseTransition(id);
  };

  const handlePhaseStop = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onStopPhase(id);
  };

  const totalTargetMinutes = useMemo(() => {
    return (scenario.phases || []).reduce((acc, p) => acc + (p.targetDurationMinutes || 0), 0);
  }, [scenario.phases]);

  return (
    <aside className={`bg-black/60 backdrop-blur-xl border-r border-white/5 flex flex-col shrink-0 shadow-2xl z-20 h-full transition-all duration-300 ease-in-out relative w-full overflow-hidden`}>
      <div className={`px-4 py-3 bg-white/[0.02] border-b border-white/10 transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 p-0 overflow-hidden' : 'opacity-100'}`}>
        <div className="flex flex-col gap-2 min-w-[200px]">
          <div className="flex flex-col relative group/clock">
            <div className="flex flex-col items-center w-full">
               <div className="flex items-center justify-center gap-2 mb-2 h-4">
                 <span className="text-[9px] font-bold font-cinzel text-white/60 uppercase tracking-[0.3em] leading-none">Session Clock</span>
                 {!sessionStartTime && (
                   <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 leading-none flex items-center">Ready</span>
                 )}
                 {isPaused && sessionStartTime && (
                   <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 leading-none shadow-[0_0_15px_rgba(245,158,11,0.1)] flex items-center">Paused</span>
                 )}
               </div>

               <div className="flex items-center justify-center gap-4 relative group/time-card w-full">
                 <div className="relative group/time-wrapper w-fit">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <span 
                          className={`text-[48px] md:text-[56px] font-mono font-black tracking-[-0.08em] tabular-nums leading-none transition-all duration-700 block select-none ${
                            !sessionStartTime 
                              ? 'text-white/35' 
                              : isPaused 
                                ? 'text-amber-500/80' 
                                : 'brightness-125'
                          }`} 
                          style={{ 
                            color: sessionStartTime && !isPaused ? themeColor : undefined,
                            textShadow: sessionStartTime && !isPaused ? `0 0 25px ${themeColor}20` : 'none'
                          }}
                        >
                          {sessionStartTime ? formatTime((now - sessionStartTime) / 1000) : "00:00"}
                        </span>
                      </div>
                      
                      <div className="flex flex-col justify-center">
                        <div className="flex flex-col items-start px-2 py-1 rounded-lg bg-white/15 border border-white/20">
                          <span className="text-[7px] font-bold font-cinzel text-white/80 uppercase tracking-[0.2em] mb-0.5">Total Est.</span>
                          <span className="text-[11px] font-mono font-bold text-white tabular-nums">{formatTime(totalTargetMinutes * 60)}</span>
                        </div>
                      </div>
                    </div>

                   <button 
                     onClick={!sessionStartTime ? onStartSession : onTogglePause}
                     className="absolute inset-[-4px] flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-0 group-hover/time-wrapper:opacity-100 transition-all duration-300 rounded-xl border border-white/10 scale-95 group-hover/time-wrapper:scale-100 outline-none cursor-pointer z-10"
                     title={!sessionStartTime ? "Start Session" : isPaused ? "Resume Session" : "Pause Session"}
                   >
                      <div className="p-2 rounded-full bg-white/10 border border-white/20 shadow-2xl">
                       {!sessionStartTime || isPaused ? (
                         <Play size={18} className="text-white fill-white translate-x-0.5" />
                       ) : (
                         <Pause size={18} className="text-white fill-white" />
                       )}
                      </div>
                   </button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <TimePickerModal 
        isOpen={showExitTimePicker}
        onClose={() => setShowExitTimePicker(false)}
        initialTime={exitTime || ''}
        onSave={onExitTimeChange}
        themeColor={themeColor}
      />

        <div 
          ref={containerRef}
          id="phase-list-container"
          className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3 mt-2"
        >
        {(scenario.phases || []).map((phase, index) => {
          const isActive = phase.id === activePhaseId;
          const isPreview = phase.id === previewPhaseId;
          const actualSeconds = getPhaseActualSeconds(phase.id);
          const targetSeconds = (phase.targetDurationMinutes || 0) * 60;
          const diffSeconds = actualSeconds - targetSeconds;
          const unlocked = isPhaseUnlocked(index);

          return (
            <div
              id={`phase-card-${phase.id}`}
              key={phase.id}
              onClick={() => handlePhaseItemClick(phase.id)}
              className={`w-full text-left px-3 py-6 rounded-xl transition-all duration-300 flex flex-col gap-2 group relative select-none cursor-pointer ${
                isActive 
                  ? 'bg-white/[0.12] border border-white/35 shadow-lg shadow-black/80' 
                  : isPreview
                    ? 'bg-white/[0.08] border border-white/25 ring-1 ring-white/20'
                    : 'bg-white/[0.09] border border-white/25 opacity-100 hover:bg-white/[0.13] hover:border-white/45'
              } ${isCollapsed ? 'items-center justify-center p-2' : ''}`}
            >
              <ConfettiEffect active={celebratingPhaseId === phase.id} color={phase.themeColor || themeColor} count={24} />
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-1">
                   <span className={`text-[12px] font-bold font-mono ${isActive ? 'text-white animate-pulse' : 'text-white/80'}`}>{index + 1}</span>
                   {phase.isLockedByPrevious && (
                      <div className={`p-1.5 rounded shadow-sm ${unlocked ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        {unlocked ? <Unlock size={14} className="text-emerald-500" /> : <Lock size={14} className="text-amber-500" />}
                      </div>
                   )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-black font-cinzel text-white/95 tracking-widest uppercase">CH. {index + 1}</span>
                      {isPreview && !isActive && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded border border-white/20 bg-white/5 text-white">
                           <Eye size={10} />
                           <span className="text-[8px] font-black font-cinzel uppercase tracking-[0.1em]">PREVIEWING</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {phase.isLockedByPrevious && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${unlocked ? 'bg-emerald-500/20 border-emerald-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                           {unlocked ? <Unlock size={10} className="text-emerald-500" /> : <Lock size={10} className="text-amber-500" />}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`text-[15.5px] font-black font-cinzel tracking-tight truncate pr-8 text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]`}>
                    {phase.name}
                  </span>
                  <div className="mt-3 flex items-center justify-between pr-8">
                    <div className="flex items-center gap-x-2 text-[16px] font-mono tabular-nums leading-none">
                      <span className={`font-black ${isActive ? 'text-white' : 'text-white/95'}`}>{formatTime(actualSeconds)}</span>
                      {targetSeconds > 0 && (
                        <span className="text-white/70 italic font-semibold">/ {formatTime(targetSeconds)}</span>
                      )}
                    </div>
                    {targetSeconds > 0 && (sessionStartTime || actualSeconds > 0) && (
                      <span className={`text-[11px] font-mono font-bold ${diffSeconds > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {diffSeconds > 0 ? '+' : '-'}{formatTime(Math.abs(diffSeconds))}
                      </span>
                    )}
                  </div>
 
                  <div className="absolute top-4 right-2 bottom-4 flex flex-col items-center justify-center gap-6 py-0.5" onClick={(e) => e.stopPropagation()}>
                    {!isActive && !phase.isCompleted && (
                      <button 
                        onClick={(e) => handlePhaseStart(e, phase.id)}
                        disabled={!unlocked}
                        className={`p-2 rounded-xl transition-all shadow-lg ${unlocked ? 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 ring-1 ring-orange-500/20' : 'text-white/5 bg-white/5 cursor-not-allowed'}`}
                        title="Start measuring this phase"
                      >
                        <Play size={18} className="fill-current" />
                      </button>
                    )}

                    {isActive && (
                       <button 
                         onClick={() => onCancelPhase()}
                         className="p-2 rounded-xl text-white/20 hover:text-white/60 bg-white/5 hover:bg-white/10 border border-white/10 transition-all shadow-lg"
                         title="Cancel/Pause this phase"
                       >
                         <Pause size={18} />
                       </button>
                    )}

                    {phase.isCompleted && (
                       <button 
                         onClick={(e) => handlePhaseStart(e, phase.id)}
                         className="p-2 rounded-xl text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
                         title="Resume/Restart this phase"
                       >
                         <RotateCcw size={18} />
                       </button>
                    )}

                    {!isActive && !phase.isCompleted && <div className="h-4" />}

                    {isActive && (
                      <button 
                        onClick={(e) => handlePhaseStop(e, phase.id)}
                        className="p-2 rounded-xl text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 ring-1 ring-yellow-500/20 transition-all shadow-[0_0_15px_rgba(234,179,8,0.2)] mt-auto"
                        title="End this phase and stop count"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                  </div>
                </>
              )}
              {isActive && <div className="absolute left-0 top-1 bottom-1 w-1 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.4)]" style={{ backgroundColor: phase.themeColor || themeColor }} />}
              {isPreview && !isActive && <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-white/20 rounded-full" />}
            </div>
          );
        })}
      </div>
    </aside>
  );
});

export default PhaseSidebar;
