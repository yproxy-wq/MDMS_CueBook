
import { Edit3, Play, Pause, Download, Upload, Volume2, RotateCcw, Heart, Info, HelpCircle, Menu, Settings, LogIn, LogOut, History, Maximize, Minimize, ChevronLeft, ChevronRight, Plus, Minus, Share, BookOpen, MessageSquare, Map, Activity, Keyboard } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import HelpModal from './HelpModal';
import UpdateLogModal from './modals/UpdateLogModal';
import ScenarioMapModal from './modals/ScenarioMapModal';
import AboutModal from './modals/AboutModal';
import ShortcutsGuideModal from './modals/ShortcutsGuideModal';
import { UPDATE_LOGS } from '../data/updateLogs';
import { User } from 'firebase/auth';
import { Phase, CustomShortcuts } from '../types';
import TimePickerModal from './TimePickerModal';
import { motion, AnimatePresence } from 'motion/react';
import { networkMonitor, NetworkState } from '../services/NetworkMonitor';
import { APP_VERSION } from '../config/version';
import xtvBrandMark from '../../dot-x.png';

interface HeaderProps {
  title: string;
  themeColor: string;
  isBTActive: boolean;
  isEditorMode: boolean;
  volume: number;
  isDucking: boolean;
  showVolume?: boolean; 
  onVolumeChange: (v: number) => void;
  onToggleDucking: () => void;
  onToggleEditor: () => void;
  onExport: (format?: 'zip' | 'cuebook') => void;
  onImport: () => void;
  onReset: () => void;
  onResetSession?: () => void;
  onOpenPreferences?: () => void;
  onOpenHistory?: () => void;
  onOpenSessionSummary?: () => void;
  onMenuShowChange?: (show: boolean) => void;
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  now?: number;
  exitTime?: string;
  onExitTimeChange?: (time: string) => void;
  // Timer props
  timerSeconds?: number;
  isTimerRunning?: boolean;
  onToggleTimer?: () => void;
  onResetTimer?: () => void;
  onAdjustTimer?: (delta: number) => void;
  onPrevTimer?: () => void;
  onNextTimer?: () => void;
  timerLabel?: string;
  totalTimers?: number;
  timerDisplayPosition?: 'header' | 'tab' | 'both';
  onOpenSync?: () => void;
  timerStartTime?: number | null;
  quotaExceeded?: boolean;
  phases: Phase[];
  currentPhaseId: string;
  phaseResults: Record<string, number>;
  scenarioName: string;
  phaseStartTime?: number;
  customShortcuts?: CustomShortcuts;
}

const XIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
  </svg>
);

const Header: React.FC<HeaderProps> = React.memo(({ 
  themeColor,
  isBTActive,
  isEditorMode, 
  volume,
  isDucking,
  showVolume = true,
  onVolumeChange,
  onToggleDucking,
  onToggleEditor,
  onExport,
  onImport,
  onReset,
  onOpenPreferences,
  onOpenHistory,
  onMenuShowChange,
  user,
  onLogin,
  onLogout,
  now,
  exitTime,
  onExitTimeChange,
  timerSeconds = 0,
  isTimerRunning = false,
  timerLabel = "TIMER",
  totalTimers = 1,
  timerDisplayPosition = 'tab',
  onOpenSync,
  timerStartTime,
  quotaExceeded = false,
  phases,
  currentPhaseId,
  phaseResults,
  scenarioName,
  onOpenSessionSummary,
  phaseStartTime,
  onResetSession,
  customShortcuts,
  onToggleTimer,
  onResetTimer,
  onAdjustTimer,
  onPrevTimer,
  onNextTimer
}) => {
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [showScenarioMap, setShowScenarioMap] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showScenarioMenu, setShowScenarioMenu] = useState(false);
  const [showUserSubMenu, setShowUserSubMenu] = useState(false);
  const [showExitTimePicker, setShowExitTimePicker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVersionOverlay, setShowVersionOverlay] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [displayTimerSeconds, setDisplayTimerSeconds] = useState(timerSeconds);
  const versionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerMenuRef = useRef<HTMLDivElement>(null);
  const [networkState, setNetworkState] = useState<NetworkState>(() => networkMonitor.getState());

  useEffect(() => {
    return networkMonitor.subscribe((state) => {
      setNetworkState(state);
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTimerMenu(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    onMenuShowChange?.(showMenu);
  }, [showMenu, onMenuShowChange]);

  const toggleMenu = () => {
    const nextShow = !showMenu;
    setShowMenu(nextShow);
    if (!nextShow) {
      setShowScenarioMenu(false);
      setShowUserSubMenu(false);
    }
  };

  const currentVersion = APP_VERSION;

  const handleVersionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showVersionOverlay) {
      setShowUpdateLog(true);
      setShowVersionOverlay(false);
      if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
    } else {
      setShowVersionOverlay(true);
      if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
      versionTimerRef.current = setTimeout(() => {
        setShowVersionOverlay(false);
      }, 4000); // 4 seconds for better readability
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable fullscreen: ${e.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (showMenu) {
          setShowMenu(false);
          setShowScenarioMenu(false);
          setShowUserSubMenu(false);
        }
      }
      if (timerMenuRef.current && !timerMenuRef.current.contains(event.target as Node)) {
        setShowTimerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu, showTimerMenu]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(Math.max(0, totalSeconds) / 60);
    const s = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getExitDiff = () => {
    if (!exitTime || !now) return null;
    const [h, m] = exitTime.split(':').map(Number);
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target.getTime() < now - 60000) {
      target.setDate(target.getDate() + 1);
    }
    const diffMs = target.getTime() - now;
    const diffSecs = Math.floor(diffMs / 1000);
    return diffSecs;
  };

  const exitDiff = getExitDiff();
  const isTimerWarning = timerSeconds < 60 && timerSeconds > 0;

  useEffect(() => {
    if (!isTimerRunning || !timerStartTime) {
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - timerStartTime) / 1000;
      const remains = Math.max(0, timerSeconds - elapsed);
      setDisplayTimerSeconds(Math.ceil(remains));
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartTime, timerSeconds]);

  const effectiveTimerSeconds = isTimerRunning && timerStartTime ? displayTimerSeconds : timerSeconds;

  const isHeaderTimerUrgent = isTimerRunning && effectiveTimerSeconds < 60 && effectiveTimerSeconds > 0;
  const isHeaderTimerCritical = isTimerRunning && effectiveTimerSeconds < 30 && effectiveTimerSeconds > 0;

  const headerShakeIntensity = isHeaderTimerUrgent 
    ? Math.max(0, Math.min(2, (60 - effectiveTimerSeconds) / 25))
    : 0;

  const headerUrgencyDuration = isHeaderTimerUrgent
    ? `${Math.max(0.12, 0.12 + (effectiveTimerSeconds / 60) * 1.38)}s`
    : '1s';

  const headerAnimationName = isHeaderTimerCritical ? 'critical-pulse' : 'urgency-pulse';

  // テナント識別子はビルド時に固定し、通常版・Stable版へブランド表示が混入しないようにする。
  const isXtvTenant = import.meta.env.VITE_CUEBOOK_TENANT === 'xtv';

  const headerUrgencyStyle = isHeaderTimerUrgent ? {
    display: 'inline-block',
    animation: `${headerAnimationName} var(--urgency-duration) infinite ease-in-out, urgency-shake var(--urgency-duration) infinite ease-in-out`,
    '--urgency-duration': headerUrgencyDuration,
    '--shake-intensity': `${headerShakeIntensity}px`
  } as React.CSSProperties : {};

  const formatTimerTime = (totalSeconds: number) => {
    const mins = Math.floor(Math.max(0, totalSeconds) / 60);
    const secs = Math.floor(Math.max(0, totalSeconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <header 
        className={`h-14 md:h-16 bg-[#0a0a0b] border-b border-white/10 flex items-center px-4 md:px-6 justify-between shrink-0 shadow-2xl relative transition-all duration-300 z-50`}
      >
        <div className="flex items-center gap-2 lg:gap-5 min-w-0 h-full">
          <button 
            onClick={handleVersionClick}
            className="flex items-center h-full group/logo relative shrink-0 pr-1"
            title="CueBook バージョン情報"
          >
            <div className="flex items-center gap-1 lg:gap-2 self-stretch relative">
              <div className="flex flex-col justify-center -space-y-1 md:-space-y-1.5 shrink-0">
                <h1 className="text-[20px] md:text-[24px] font-cinzel font-black tracking-widest text-[#d8d8d8] flex items-center relative pl-2 md:pl-3">
                  <img 
                    src="https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/nib.png" 
                    alt="Nib" 
                    className="absolute -left-5 md:-left-8 -top-3.5 md:-top-6 w-14 h-14 md:w-20 md:h-20 object-contain opacity-75 mix-blend-screen pointer-events-none filter drop-shadow-[0_0_12px_rgba(254,240,138,0.8)] rotate-[10deg]"
                    referrerPolicy="no-referrer"
                  />
                  <span style={{ color: '#d8d8d8', textShadow: `0 0 15px ${themeColor}, 0 0 8px rgba(254, 240, 138, 0.9), 0 0 3px rgba(255, 255, 255, 0.9)`, fontSize: '115%', display: 'inline-block', position: 'relative', zIndex: 1 }}>C</span>
                  <span style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.8), 0 0 8px rgba(254, 240, 138, 0.6), 0 0 3px rgba(255, 255, 255, 0.8)' }}>ue</span>
                  <span style={{ color: '#d8d8d8', textShadow: `0 0 15px ${themeColor}, 0 0 8px rgba(254, 240, 138, 0.9), 0 0 3px rgba(255, 255, 255, 0.9)`, fontSize: '115%', display: 'inline-block' }}>B</span>
                  <span style={{ textShadow: '0 0 15px rgba(255, 255, 255, 0.8), 0 0 8px rgba(254, 240, 138, 0.6), 0 0 3px rgba(255, 255, 255, 0.8)' }}>ook</span>
                  {isXtvTenant && (
                    <img
                      src={xtvBrandMark}
                      alt="XTV"
                      className="ml-1 h-6 w-6 shrink-0 object-contain md:h-8 md:w-8"
                    />
                  )}
                </h1>
              </div>

              <AnimatePresence>
                {showVersionOverlay && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 bg-zinc-900/90 backdrop-blur-md rounded flex items-center justify-center z-[110] border border-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUpdateLog(true);
                      setShowVersionOverlay(false);
                      if (versionTimerRef.current) clearTimeout(versionTimerRef.current);
                    }}
                  >
                    <span className="text-[10px] md:text-xs font-mono font-black text-yellow-400 tracking-tighter shadow-lg">
                      {currentVersion}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>

          <div className="h-6 md:h-8 w-px bg-white/20 shrink-0 mx-1 md:mx-3" />
          
          {/* TIME DISPLAY AREA */}
          <div className="flex items-center gap-3 lg:gap-8">
            <div className="flex flex-col items-center justify-center">
              <span className="text-lg md:text-2xl lg:text-3xl font-mono font-black text-white tabular-nums leading-none tracking-tight">
                {now ? formatTimestamp(now) : '--:--'}
              </span>
            </div>

            <button 
              onClick={() => setShowExitTimePicker(true)}
              className="flex flex-col items-center group/exit transition-all"
            >
              <span className="text-[7px] md:text-[8px] font-bold font-cinzel text-white uppercase tracking-[0.2em] mb-0.5 md:mb-1 leading-none group-hover/exit:text-amber-400 transition-colors hidden lg:inline">退出予定</span>
              <div className="flex flex-col items-center relative gap-0.5">
                <span className="text-sm md:text-xl font-mono font-black text-amber-400 tabular-nums leading-none group-hover/exit:brightness-125 transition-all tracking-tight">
                  {exitTime || '--:--'}
                </span>
                {exitTime && exitDiff !== null && (
                  <div className="flex items-center gap-1 leading-none whitespace-nowrap">
                    <span className="hidden lg:inline text-[6px] font-bold font-cinzel text-amber-500/80 uppercase tracking-widest">REMAIN:</span>
                    <span className={`text-[8px] md:text-[9px] font-mono font-bold tabular-nums ${exitDiff < 300 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                      {(exitDiff < 0 ? '-' : '') + formatTime(Math.abs(exitDiff))}
                    </span>
                  </div>
                )}
              </div>
            </button>
          </div>
          
          {/* COMPACT TIMER IN HEADER */}
          {!isEditorMode && (timerDisplayPosition === 'header' || timerDisplayPosition === 'both') && (
            <div className="hidden md:flex items-center h-full">
              <div className="h-6 md:h-8 w-px bg-white/20 shrink-0 mx-1 md:mx-2" />
              <div className="flex items-center gap-1 md:gap-2 px-1 bg-white/10 rounded-xl border border-white/20 h-10 md:h-12 relative group/timer transition-all hover:bg-white/15">
                 {totalTimers > 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onPrevTimer?.(); }}
                      className="p-1 px-1.5 text-white/75 hover:text-white transition-colors h-full flex items-center"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                 )}
                 
                 <div 
                   className="flex flex-col items-center min-w-[70px] md:min-w-[100px] cursor-pointer relative justify-center"
                   onClick={(e) => {
                     e.stopPropagation();
                     setShowTimerMenu(!showTimerMenu);
                   }}
                   ref={timerMenuRef}
                  >
                    <div className="flex items-center gap-1.5 leading-none mb-0.5">
                      <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full transition-all duration-500 ${isTimerRunning ? 'animate-pulse' : 'bg-white/10'}`} style={{ backgroundColor: isTimerRunning ? themeColor : undefined, boxShadow: isTimerRunning ? `0 0 10px ${themeColor}` : 'none' }} />
                      <span className="text-[7px] md:text-[8px] font-bold font-cinzel text-white/80 uppercase tracking-widest truncate max-w-[60px] md:max-w-[100px]">
                        {timerLabel}
                      </span>
                    </div>
                    <div 
                      className={`text-sm md:text-2xl font-mono font-black tabular-nums transition-all duration-300 ${isTimerWarning && isTimerRunning ? 'text-red-500' : 'text-white'}`}
                      style={{ 
                        color: !isTimerWarning && isTimerRunning ? themeColor : undefined,
                        ...headerUrgencyStyle
                      }}
                    >
                      {formatTimerTime(effectiveTimerSeconds)}
                    </div>

                    {/* FLOAT REVEAL PLAY/PAUSE ICON (CENTRAL) */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/timer:opacity-100 transition-opacity cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTimer?.();
                      }}
                      title={isTimerRunning ? "Pause Timer" : "Start Timer"}
                    >
                      <div className="bg-black/60 backdrop-blur-sm rounded-full p-2 border border-white/20 scale-75 md:scale-100 shadow-2xl" style={{ color: themeColor }}>
                        {isTimerRunning ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                      </div>
                    </div>

                    {/* NEW TIMER DROPDOWN MENU */}
                    <AnimatePresence>
                      {showTimerMenu && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10, x: "-50%", scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
                          exit={{ opacity: 0, y: -10, x: "-50%", scale: 0.95 }}
                          className="absolute top-full mt-4 left-1/2 w-48 bg-[#0c0c0d]/98 border rounded-xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] z-[9999] backdrop-blur-3xl p-1.5 cursor-default"
                          style={{ borderColor: themeColor + '1a', boxShadow: `0 25px 70px rgba(0,0,0,0.9), 0 0 20px ${themeColor}10` }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <motion.button 
                            whileHover={{ scale: 1.02, backgroundColor: themeColor + '3d', borderColor: themeColor + '80' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              onOpenSync?.();
                              setShowTimerMenu(false);
                            }}
                            style={{ backgroundColor: themeColor + '26', borderColor: themeColor + '4d', color: themeColor }}
                            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg border transition-all text-center cursor-pointer font-bold shadow-inner"
                          >
                            <Settings size={15} />
                            <span className="text-[11px] font-bold font-cinzel tracking-widest uppercase">子ウィンドウ設定</span>
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 {totalTimers > 1 && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onNextTimer?.(); }}
                      className="p-1 px-1.5 text-white/75 hover:text-white transition-colors h-full flex items-center"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                 )}

                 {/* FLOATING CONTROLS POPUP (BELOW) */}
                 <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 invisible group-hover/timer:opacity-100 group-hover/timer:visible transition-all duration-200 z-[500] flex items-center gap-1 p-1 bg-[#121212] border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl scale-90 group-hover/timer:scale-100 min-w-fit whitespace-nowrap">
                  {onOpenSync && (
                    <>
                      <button 
                         onClick={(e) => { e.stopPropagation(); onOpenSync(); }} 
                         className="flex flex-col items-center justify-center w-10 h-10 text-sky-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all" 
                         title="Sync Window"
                      >
                         <Share size={14} />
                         <span className="text-[7px] font-bold font-cinzel">SYNC</span>
                      </button>
                      <div className="w-px h-6 bg-white/10" />
                    </>
                  )}
                   <button 
                      onClick={(e) => { e.stopPropagation(); onAdjustTimer?.(-60); }} 
                      className="flex flex-col items-center justify-center w-10 h-10 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                      title="-1min"
                   >
                      <Minus size={14} className="text-white/80" />
                      <span className="text-[7px] font-bold">1 m</span>
                   </button>
                   <div className="w-px h-6 bg-white/10" />
                   <button 
                      onClick={(e) => { e.stopPropagation(); onResetTimer?.(); }} 
                      className="flex flex-col items-center justify-center w-10 h-10 text-white/60 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all" 
                      title="Reset"
                   >
                      <RotateCcw size={14} />
                      <span className="text-[7px] font-bold font-cinzel">RESET</span>
                   </button>
                   <div className="w-px h-6 bg-white/10" />
                   <button 
                      onClick={(e) => { e.stopPropagation(); onAdjustTimer?.(60); }} 
                      className="flex flex-col items-center justify-center w-10 h-10 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                      title="+1min"
                   >
                      <Plus size={14} className="text-white/80" />
                      <span className="text-[7px] font-bold">1 m</span>
                   </button>
                 </div>
              </div>
            </div>
          )}

          <div className="hidden md:block h-6 md:h-8 w-px bg-white/20 shrink-0 mx-1 md:mx-2" />
            {isBTActive && (
              <div 
                className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-500 animate-in fade-in zoom-in duration-500 cursor-help"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                <span className="hidden lg:inline text-[8px] md:text-[9px] font-bold font-mono tracking-tighter uppercase">Bluetooth keep alive</span>
                
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] backdrop-blur-xl">
                  <p className="text-[9px] leading-relaxed text-white/70 font-sans">
                    Bluetoothスピーカー等の自動スリープを防止するため、微弱な信号を継続的に出力しています。
                  </p>
                </div>
              </div>
            )}

              {user && (
                <div 
                  className={`group relative flex items-center gap-1.5 px-2 py-1 rounded-full border animate-in fade-in zoom-in duration-500 cursor-help transition-all ${
                    quotaExceeded 
                      ? 'bg-red-500/10 border-red-500/30 text-red-500' 
                      : networkState.status === 'disconnected'
                      ? 'bg-red-500/10 border-red-500/30 text-red-500'
                      : networkState.status === 'unreliable'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
                  }`}
                  style={{
                    boxShadow: quotaExceeded
                      ? 'none'
                      : networkState.status === 'disconnected'
                      ? '0 0 10px rgba(239, 68, 68, 0.2)'
                      : networkState.status === 'unreliable'
                      ? '0 0 12px rgba(245, 158, 11, 0.5)'
                      : '0 0 10px rgba(16, 185, 129, 0.2)'
                  }}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${quotaExceeded ? 'bg-red-500' : 'animate-pulse'} ${
                    quotaExceeded 
                      ? 'bg-red-500' 
                      : networkState.status === 'disconnected'
                      ? 'bg-red-500'
                      : networkState.status === 'unreliable'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`} />
                  
                  <span className="text-[8px] md:text-[9px] font-bold font-mono tracking-tighter uppercase whitespace-nowrap">
                    {quotaExceeded 
                      ? 'SYNC PAUSED (QUOTA)' 
                      : networkState.status === 'disconnected'
                      ? 'OFFLINE'
                      : networkState.status === 'unreliable'
                      ? networkState.adGuardDetected 
                        ? 'BLOCKED / ADGUARD' 
                        : 'SYNC UNSTABLE'
                      : 'SYNC HEALTHY'}
                  </span>
                  
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 p-3 bg-zinc-950/95 border border-white/10 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] backdrop-blur-xl">
                    <div className="text-[9px] leading-relaxed text-white/70 font-sans space-y-1.5">
                      {quotaExceeded ? (
                        <p>Firestoreの無料利用枠を超過しました。本日の同期機能は停止されますが、ローカルでの動作には影響ありません。明日リセットされます。</p>
                      ) : (
                        <>
                          <p className="font-bold border-b border-white/10 pb-1 text-white">
                            {networkState.status === 'disconnected' && '接続切断 (OFFLINE)'}
                            {networkState.status === 'unreliable' && (networkState.adGuardDetected ? 'ブロック検知 / ADGUARD' : '通信不安定')}
                            {networkState.status === 'healthy' && '同期正常 (SYNC HEALTHY)'}
                          </p>
                          <p>
                            {networkState.status === 'disconnected' && 'インターネット接続が失われました。タイマー等のプレイヤー同期は再接続までオフラインになります。'}
                            {networkState.status === 'unreliable' && (
                              networkState.adGuardDetected 
                                ? 'AdGuard等のコンテンツブロッカーが同期の通信（Firestore Stream/WS）を妨害している、または失敗したことを検出しました。GMタイマー同期が不正確になる可能性があります。'
                                : '接続エラーが発生しました。バックオフ自動再試行スケジュールを実行中です。'
                            )}
                            {networkState.status === 'healthy' && 'Firestoreおよび同期ストリームは安定しています。タイマー状態や進行がミリ秒精度でプレイヤーと完全に同期されています。'}
                          </p>
                          {networkState.lastError && (
                            <div className="font-mono text-[7px] text-zinc-400 mt-1 truncate border-t border-white/5 pt-1">
                              Err: {networkState.lastError}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>

        {!isEditorMode && showVolume && (
          <div className="flex flex-1 max-w-[10rem] md:max-w-xs mx-1 md:mx-6 items-center gap-1 md:gap-4 p-1 px-3 md:px-4 bg-white/10 border border-white/20 rounded-xl group/vol min-w-[5rem] md:min-w-[10rem] animate-in fade-in slide-in-from-top-1 duration-500">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Volume2 size={14} className="text-white/85 shrink-0 group-hover/vol:text-white transition-colors" />
              <input 
                type="range" min="0" max="1" step="0.01" value={volume || 0}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-white hover:accent-yellow-400 transition-all min-w-0 ring-offset-black"
              />
            </div>
            <button 
              onClick={onToggleDucking}
              className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black font-cinzel tracking-widest transition-all border shrink-0
                ${isDucking ? 'bg-red-500/20 text-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/10 text-white/75 border-white/25 hover:bg-white/15 hover:text-white/95'}`}
            >
              <span className={isDucking ? 'opacity-35' : 'opacity-100'}>BGM</span>
              <span className="opacity-20">|</span>
              <span className={isDucking ? 'opacity-100' : 'opacity-35'}>VOICE</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 lg:gap-4 shrink-0 h-full ml-auto">
          {isEditorMode && (
            <button
              onClick={onToggleEditor}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white transition-all flex items-center gap-1.5 border border-white/10 shadow-sm mr-1.5 duration-150"
              title="通常モード（GM画面）に戻る"
            >
              <ChevronLeft size={16} />
              <span className="text-[10px] font-bold font-sans tracking-widest text-white/80 leading-none">GM画面に戻る</span>
            </button>
          )}

          <div className="relative" ref={menuRef}>
            {/* Scenario Map Button */}
            <button 
              onClick={() => setShowScenarioMap(true)}
              className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="シナリオマップ"
            >
              <Map size={18} />
            </button>

            {/* Keyboard Shortcuts Button */}
            <button 
              onClick={() => setShowShortcuts(true)}
              className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="ショートカットキー一覧 (Keyboard Shortcuts)"
            >
              <Keyboard size={18} />
            </button>

            <button 
              onClick={toggleMenu}
              className={`p-2 rounded-md transition-all ${showMenu ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
              title="メニュー"
            >
              <Menu size={18} />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                {/* User Info (If logged in) */}
                {user && (
                  <div className="relative border-b border-white/10">
                    <div className="px-3 py-2 bg-white/5 flex items-center justify-between gap-1">
                      {/* Left三角ボタン。押すとトグル */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowUserSubMenu(!showUserSubMenu);
                        }}
                        className={`p-1 rounded transition-all shrink-0 hover:bg-white/10 flex items-center justify-center
                          ${showUserSubMenu ? 'text-sky-400 bg-white/5' : 'text-white/40 hover:text-white'}`}
                        title="操作メニューを展開"
                      >
                        <ChevronLeft 
                          size={14} 
                          className={`transition-transform duration-300 ${showUserSubMenu ? 'rotate-180 text-sky-400' : ''}`}
                          style={{ color: showUserSubMenu ? themeColor : undefined }}
                        />
                      </button>
                      
                      {/* User Icon & Name */}
                      <div className="flex items-center gap-1.5 flex-grow min-w-0">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="User" referrerPolicy="no-referrer" className="w-5 h-5 rounded-full border border-white/20 shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/50 shrink-0">U</div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[7px] font-bold font-cinzel text-white/30 uppercase tracking-widest leading-none">ログインユーザー</span>
                          <span className="text-[10px] font-bold text-white/70 truncate max-w-[90px]" title={user.displayName || 'User'}>
                            {user.displayName || 'User'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 左へ飛び出すサブメニュー (HISTORY, LOGOUT) */}
                    <AnimatePresence>
                      {showUserSubMenu && (
                        <motion.div 
                          initial={{ opacity: 0, x: 20, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 20, scale: 0.95 }}
                          className="absolute top-0 right-full mr-2 w-48 bg-[#0c0c0d]/98 border border-white/10 rounded-xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden z-[110] backdrop-blur-3xl py-1"
                        >
                          {/* Performance History */}
                          <button 
                            onClick={() => {
                              onOpenHistory?.();
                              setShowUserSubMenu(false);
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left cursor-pointer"
                          >
                            <History size={14} />
                            <span className="text-xs font-bold font-cinzel tracking-widest uppercase">セクション履歴</span>
                          </button>

                          {/* Logout */}
                          <button 
                            onClick={() => {
                              onLogout();
                              setShowUserSubMenu(false);
                              setShowMenu(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:text-red-400 hover:bg-white/5 transition-colors text-left cursor-pointer"
                          >
                            <LogOut size={14} />
                            <span className="text-xs font-bold font-cinzel tracking-widest uppercase">ログアウト</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Login option when not logged in */}
                {!user && (
                  <button 
                    onClick={() => {
                      onLogin();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left cursor-pointer"
                  >
                    <LogIn size={16} />
                    <span className="text-xs font-bold font-cinzel tracking-widest uppercase">ログイン</span>
                  </button>
                )}

                <button 
                  onClick={() => {
                    setShowUpdateLog(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-yellow-400 hover:text-yellow-300 hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <Info size={16} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-cinzel text-white/90">バージョン情報</span>
                    <span className="text-[9px] font-mono opacity-60">{currentVersion}</span>
                  </div>
                </button>

                <button 
                  onClick={() => {
                    setShowShortcuts(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-amber-400 hover:text-amber-300 hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <Keyboard size={16} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-cinzel text-white/90">ショートカット一覧</span>
                    <span className="text-[9px] font-mono opacity-60">キーボード操作の全ガイド</span>
                  </div>
                </button>

                {/* Scenario Item with sub-menu */}
                <div className="relative border-b border-white/5 group/scen"
                  onMouseEnter={() => setShowScenarioMenu(true)}
                  onMouseLeave={() => setShowScenarioMenu(false)}
                >
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setShowScenarioMenu(!showScenarioMenu);
                    }} 
                    className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${showScenarioMenu ? 'bg-white/5 text-emerald-400' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} />
                      <span className="text-xs font-bold font-cinzel tracking-widest uppercase">シナリオ管理</span>
                    </div>
                    <div className="flex items-center">
                      <div className={`w-1 h-1 rounded-full bg-emerald-500 mr-2 transition-opacity duration-300 ${showScenarioMenu ? 'opacity-100' : 'opacity-0'}`} />
                      <ChevronLeft size={14} className={`text-white/20 transition-transform duration-300 ${showScenarioMenu ? 'translate-x-[-4px] text-emerald-400' : ''}`} />
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {showScenarioMenu && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className="absolute top-0 right-full mr-2 w-52 bg-[#0c0c0d]/95 border border-white/10 rounded-xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] overflow-hidden z-[110] backdrop-blur-3xl"
                      >
                        <div className="px-4 py-3 bg-emerald-500/10 border-b border-white/10">
                          <span className="text-[9px] font-bold font-cinzel text-emerald-400 tracking-[0.3em] uppercase">Scenario MGMT</span>
                        </div>
                        {/* Play / Edit Session Toggle */}
                        <button 
                          onClick={() => {
                            onToggleEditor();
                            setShowScenarioMenu(false);
                            setShowMenu(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 transition-colors border-b border-white/5 text-left cursor-pointer hover:bg-white/5 text-sky-400 hover:text-sky-300"
                        >
                          <span className="inline-flex items-center shrink-0">
                            {isEditorMode ? <Play size={14} fill="currentColor" /> : <Edit3 size={14} />}
                          </span>
                          <span className="text-[10px] font-bold font-cinzel tracking-wider uppercase">
                            {isEditorMode ? '通常モード（SESSION）' : '編集ウィンドウ（EDIT）'}
                          </span>
                        </button>
                        <button 
                          onClick={() => { onImport(); setShowMenu(false); }} 
                          className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left cursor-pointer"
                        >
                          <Upload size={14} className="text-white/80" />
                          <span className="text-[10px] font-bold font-cinzel tracking-wider uppercase">インポート</span>
                        </button>
                        
                        <div className="border-b border-white/5">
                          <button 
                            onClick={() => { onExport('cuebook'); setShowMenu(false); }} 
                            className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:text-white hover:bg-white/5 transition-colors text-left cursor-pointer"
                          >
                            <Download size={14} className="text-white/80" />
                            <span className="text-[10px] font-bold font-cinzel tracking-wider uppercase">エクスポート</span>
                          </button>
                          <button 
                             onClick={() => { onExport('zip'); setShowMenu(false); }}
                             className="w-full py-1.5 text-[8.5px] font-mono text-white/40 hover:text-sky-300 transition-colors text-center uppercase cursor-pointer"
                          >
                            EXPORT as .zip
                          </button>
                        </div>

                        {!isEditorMode && (
                          <div className="border-b border-white/5">
                            <button 
                              onClick={() => { onResetSession?.(); setShowScenarioMenu(false); setShowMenu(false); }} 
                              className="w-full flex items-center gap-3 px-4 py-3 text-amber-400 hover:text-amber-300 hover:bg-amber-400/5 transition-colors text-left cursor-pointer"
                            >
                              <RotateCcw size={14} className="text-amber-400" />
                              <span className="text-[10px] font-bold font-cinzel tracking-wider uppercase whitespace-nowrap">セッションリセット</span>
                            </button>
                          </div>
                        )}

                        {!isEditorMode && (
                          <button 
                            onClick={() => { onReset(); setShowMenu(false); }} 
                            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:text-red-500 hover:bg-red-500/5 transition-colors text-left"
                          >
                            <RotateCcw size={14} />
                            <span className="text-[10px] font-bold font-cinzel tracking-wider uppercase whitespace-nowrap">リセット</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={() => {
                    onOpenPreferences?.();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <Settings size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest">設定</span>
                </button>
                {onOpenSessionSummary && (
                  <button 
                    onClick={() => {
                      onOpenSessionSummary();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                  >
                    <Activity size={16} />
                    <span className="text-xs font-bold font-cinzel tracking-widest">セッション統計 (SUMMARY)</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    toggleFullscreen();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                  <span className="text-xs font-bold font-cinzel tracking-widest">
                    {isFullscreen ? 'フルスクリーン OFF' : 'フルスクリーン ON'}
                  </span>
                </button>
                <button 
                  onClick={() => {
                    setShowHelp(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <HelpCircle size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest">簡易ヘルプ</span>
                </button>
                <a 
                  href="/manual-a.html" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sky-400/90 hover:text-sky-300 hover:bg-sky-500/10 transition-colors border-b border-white/5 text-left"
                >
                  <BookOpen size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest uppercase">Webマニュアル</span>
                </a>
                <button 
                  onClick={() => {
                    onOpenSync?.();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <Share size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest">子ウィンドウ設定</span>
                </button>
                <a 
                  href="https://forms.gle/oQ9mSQaCwPHP6TNA9" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <MessageSquare size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest uppercase">不具合報告・ご要望</span>
                </a>
                <a 
                  href="https://x.com/BloblobberLover" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5 text-left"
                >
                  <XIcon size={16} />
                  <span className="text-xs font-bold font-cinzel tracking-widest uppercase">公式X (Twitter)</span>
                </a>
                <a 
                  href="https://keikeilab-net.booth.pm/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 px-4 py-3 text-red-500/80 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  <Heart size={16} fill="currentColor" />
                  <span className="text-xs font-bold font-cinzel tracking-widest">開発支援</span>
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <ScenarioMapModal
        isOpen={showScenarioMap}
        onClose={() => setShowScenarioMap(false)}
        phases={phases}
        currentPhaseId={currentPhaseId}
        phaseResults={phaseResults}
        scenarioName={scenarioName}
        phaseStartTime={phaseStartTime}
      />

      <UpdateLogModal 
        isOpen={showUpdateLog} 
        onClose={() => setShowUpdateLog(false)} 
        themeColor={themeColor} 
        updateLogs={UPDATE_LOGS} 
      />

      <HelpModal 
        isOpen={showHelp} 
        onClose={() => setShowHelp(false)} 
        themeColor={themeColor} 
      />

      <AboutModal 
        isOpen={showAbout} 
        onClose={() => setShowAbout(false)} 
        themeColor={themeColor} 
        version={currentVersion} 
      />

      <ShortcutsGuideModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        themeColor={themeColor}
        customShortcuts={customShortcuts}
        isEditorMode={false}
      />

      {showExitTimePicker && onExitTimeChange && (
        <TimePickerModal 
          isOpen={showExitTimePicker}
          onClose={() => setShowExitTimePicker(false)}
          initialTime={exitTime || '18:00'}
          onSave={(time) => {
            onExitTimeChange(time);
            setShowExitTimePicker(false);
          }}
          themeColor={themeColor}
        />
      )}

    </>
  );
});

export default Header;
