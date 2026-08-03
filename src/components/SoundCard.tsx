import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Hand, MousePointer2, Repeat, Star } from 'lucide-react';
import { SoundConfig } from '../types';
import { audioService } from '../services/AudioService';

interface SoundCardProps {
  sound: SoundConfig;
  active: boolean;
  isLinked: boolean;
  customColor: string;
  isNarrow?: boolean;
  onToggleSound: (sound: SoundConfig) => void;
  onPlaySound?: (sound: SoundConfig) => void;
  onStopSound?: (soundId: string) => void;
  onUpdateSoundConfig?: (soundId: string, updates: Partial<SoundConfig>) => void;
}

const PlaybackStatsDisplay: React.FC<{ soundId: string }> = React.memo(({ soundId }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const stats = audioService.getPlaybackStats(soundId);
      if (stats) setCurrent(stats.current);
    }, 500);
    return () => clearInterval(interval);
  }, [soundId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <span className="text-[8px] font-mono font-bold text-white/70 bg-black/70 px-1.5 py-0.5 rounded border border-white/10 tracking-wider">
      {formatTime(current)}
    </span>
  );
});

PlaybackStatsDisplay.displayName = 'PlaybackStatsDisplay';

export const SoundCard: React.FC<SoundCardProps> = React.memo(({
  sound,
  active,
  isLinked,
  customColor,
  isNarrow = false,
  onToggleSound,
  onPlaySound,
  onStopSound,
  onUpdateSoundConfig
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isHold = sound.triggerMode === 'hold';
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-clear hover state when clicked outside on touch devices
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsHovered(false);
      }
    };
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handlePlayFromStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (active) {
      // If already playing, seek to beginning (or stop and replay)
      audioService.seek(sound.id, sound.startTime || 0);
    } else {
      // If stopped, play sound directly
      if (onPlaySound) {
        onPlaySound(sound);
      } else {
        onToggleSound(sound);
      }
    }
  };

  const handlePlayOrStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isHold) {
      onToggleSound(sound);
    }
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => {
        if (isHold && onPlaySound) onPlaySound(sound);
      }}
      onMouseUp={() => {
        if (isHold && onStopSound) onStopSound(sound.id);
      }}
      onTouchStart={(e) => {
        if (isHold && onPlaySound) {
          e.preventDefault();
          onPlaySound(sound);
        } else if (!isHold && !isHovered) {
          // On mobile, first touch opens the controls overlay
          e.preventDefault();
          setIsHovered(true);
        }
      }}
      onTouchEnd={(e) => {
        if (isHold && onStopSound) {
          e.preventDefault();
          onStopSound(sound.id);
        }
      }}
      style={{
        borderColor: active ? customColor : isLinked ? 'rgba(255, 253, 240, 0.5)' : 'rgba(255,255,255,0.20)',
        boxShadow: active ? `0 0 12px ${customColor}22` : 'none'
      }}
      className={`relative group rounded-xl flex flex-col gap-1 transition-all duration-300 border overflow-hidden select-none
        ${isNarrow ? 'px-2 py-2' : 'px-2.5 py-2.5'}
        ${active 
          ? `bg-black/90 backdrop-blur-md ring-1 ring-inset ring-white/10` 
          : isLinked 
            ? `bg-[#fffdf0]/10 hover:bg-[#fffdf0]/15` 
            : `bg-white/[0.08] hover:bg-white/[0.14]`
        }
        ${isHold && active ? 'scale-[0.98] shadow-inner translate-y-0.5' : 'hover:scale-[1.01] active:scale-98'}
      `}
    >
      {/* Front UI Contents */}
      <div className="w-full flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {isLinked && (
            <div className="flex items-center gap-1 text-[#fffdf0] shrink-0">
              <Star size={10} fill="currentColor" />
            </div>
          )}
          {sound.triggerMode === 'hold' ? (
            <Hand size={10} className={`${active ? 'text-white' : 'text-white/75'} shrink-0`} />
          ) : sound.triggerMode === 'toggle' ? (
            <Repeat size={10} className={`${active ? 'text-white' : 'text-white/75'} shrink-0`} />
          ) : (
            <MousePointer2 size={10} className="text-white/70 shrink-0" />
          )}
          <div className={`${isNarrow ? 'text-[10px]' : 'text-[11px]'} font-bold truncate transition-colors ${active || isLinked ? 'text-white font-sans' : 'text-white/80 group-hover:text-white font-sans'}`}>
            {sound.name}
          </div>
        </div>
        {active && (
          <PlaybackStatsDisplay soundId={sound.id} />
        )}
      </div>
      
      <div className="w-full flex items-center gap-2">
        <span className="text-[7.5px] font-black uppercase font-cinzel tracking-wider opacity-65" style={{ color: active ? customColor : undefined }}>
          {sound.type}
        </span>
        
        {/* IN, OUT, LOOP triggers */}
        <div className="flex gap-1.5 ml-auto shrink-0 z-10">
          {[
            { label: isNarrow ? 'I' : 'IN', field: 'fadeInEnabled' as const, color: 'text-sky-400' },
            { label: isNarrow ? 'O' : 'OUT', field: 'fadeOutEnabled' as const, color: 'text-amber-400' },
            { label: isNarrow ? 'L' : 'LOOP', field: 'loopEnabled' as const, color: 'text-emerald-400' }
          ].map(indicator => {
            const isEnabled = !!sound[indicator.field];
            return (
              <span 
                key={indicator.label}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateSoundConfig?.(sound.id, { [indicator.field]: !isEnabled });
                }}
                className={`text-[8px] font-black px-1.5 rounded-sm border transition-all cursor-pointer flex items-center justify-center min-w-[1.5rem] h-[18px]
                  ${isEnabled 
                    ? `border-white/20 ${indicator.color} bg-white/10 shadow-[0_0_8px_rgba(255,255,255,0.05)]` 
                    : 'border-white/10 text-white/35 bg-transparent opacity-60 hover:opacity-100 hover:text-white'
                  }`}
              >
                {indicator.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* 
        Sleek Audio Overlays according to rule:
        - "再生されていないものは "停止" の半透明UIが表示されるようにしよう。"
        - "カーソルか、1回タップしたときに、"停止"から"再生" と、"最初から再生" ボタンに代わる感じで。"
        - "再生中はもちろん、"再生"。"
      */}
      {!isHold && (
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 rounded-xl overflow-hidden
            ${isHovered 
              ? 'bg-black/85 opacity-100 backdrop-blur-[3px] pointer-events-auto' 
              : active 
                ? 'bg-emerald-500/[0.03] opacity-100 pointer-events-none'
                : 'bg-black/15 opacity-100 pointer-events-none'
            }
          `}
        >
          {isHovered ? (
            /* Hover Controls State */
            <div className="flex items-center gap-1.5 w-full h-full px-4 animate-in fade-in zoom-in-95 duration-150">
              <button 
                onClick={handlePlayOrStop}
                className={`flex-1 py-1.5 px-2 rounded-md font-sans text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 border cursor-pointer
                  ${active 
                    ? 'bg-red-500/15 text-red-400 border-red-500/20 hover:bg-red-500/25 hover:text-red-300' 
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25 hover:text-emerald-300'
                  }`}
              >
                {active ? (
                  <>
                    <Pause size={10} fill="currentColor" />
                    停止
                  </>
                ) : (
                  <>
                    <Play size={10} fill="currentColor" />
                    再生
                  </>
                )}
              </button>
              <button 
                onClick={handlePlayFromStart}
                className="flex-1 py-1.5 px-2 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/20 hover:border-sky-500/35 text-sky-400 hover:text-sky-300 font-sans text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
              >
                <RotateCcw size={10} />
                最初から
              </button>
            </div>
          ) : (
            /* Passive States: either active (Playing) or inert (Stopped) */
            <div className="flex items-center justify-center pointer-events-none w-full h-full select-none">
              {active ? (
                /* Centered Video-style Playing Icon (Triangle) */
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_16px_rgba(16,185,129,0.25)] text-emerald-400">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current stroke-none ml-0.5 animate-pulse" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5v14l11-7z" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </div>
              ) : (
                /* Centered Video-style Stopped Icon (Square) */
                <div className="flex items-center justify-center w-11 h-11 rounded-full bg-black/60 border border-white/35 text-white/75 transition-all duration-300 group-hover:border-white/50 group-hover:text-white shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current stroke-none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="14" height="14" rx="1.5" />
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Right Edge active color indicator indicator bar */}
      {active && <div className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl" style={{ backgroundColor: customColor }} />}
    </div>
  );
});

SoundCard.displayName = 'SoundCard';
export default SoundCard;
