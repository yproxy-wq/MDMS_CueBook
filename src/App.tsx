
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { INITIAL_SCENARIO, BLANK_SCENARIO } from './constants';
import { audioService } from './services/AudioService';
import { storageService } from './services/StorageService';
import { syncService, TimerSyncData } from './services/SyncService';
import { sessionRecoveryService } from './services/sessionRecoveryService';
import PlayerHandoutLoader from './components/PlayerHandoutLoader';
import PhaseSidebar from './components/PhaseSidebar';
import PhaseProgressNav from './components/PhaseProgressNav';
import PhaseCard from './components/PhaseCard';
import { collection, addDoc, query, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { AppState, Character, Performance, Phase, Scenario, ScenarioSnapshot, SoundCluster, SoundConfig, SoundType } from './types';
import { db, setOnQuotaExceededListener, handleFirestoreError, OperationType, isQuotaExceeded as checkQuotaInitial } from './lib/firebase';
import { addSmartSnapshot } from './utils/snapshotHelper';
import { v4 as uuidv4 } from 'uuid';
import LiveHeader from './components/LiveHeader';
import ScriptViewer from './components/ScriptViewer';
import SoundBoard from './components/SoundBoard';
import TimerCard from './components/Timer';
import { AppModals } from './components/modals/AppModals';
import { PhaseSearchModal } from './components/modals/PhaseSearchModal';
import { QuickActionsModal } from './components/modals/QuickActionsModal';
import PostSessionSummaryModal from './components/modals/PostSessionSummaryModal';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw, History, ShieldAlert, X, Layout, Minus, Plus, Settings, Play, Pause, Volume2 } from 'lucide-react';
import JSZip from 'jszip';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import TimerShareView from './components/TimerShareView';
import { NetworkToast } from './components/NetworkToast';
import { SyncTroubleshooter } from './components/SyncTroubleshooter';
import { selectSyncMedia, transformDropboxUrl } from './utils/mediaHelper';
import { createSecureShareId, createTimerSessionId, isSecureShareId } from './utils/syncHelper';
import { buildAppWindowUrl, getAppWindowMode } from './utils/appRoute';

import { useDisplayNow } from './hooks/useDisplayNow';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import { useAudioController } from './hooks/useAudioController';
import { usePhaseManager } from './hooks/usePhaseManager';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useQuotaCheck } from './hooks/useQuotaCheck';
import { useFloatingTimer } from './hooks/useFloatingTimer';
import { useLocalVideos } from './hooks/useLocalVideos';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { FloatingTimerOverlay } from './components/FloatingTimerOverlay';

const EditorView = React.lazy(() => import('./components/EditorView'));

const EMPTY_CHARACTERS: Character[] = [];
const EMPTY_PDF_PAGE_STATES: Record<string, number> = {};

type MobileTab = 'phases' | 'script' | 'audio';
type ColumnFocus = 'left' | 'right';

const CompactTimerReadout: React.FC<{
  timerState: AppState['timerStates'][string] | null;
  className: string;
  fontSize?: string;
}> = React.memo(({ timerState, className, fontSize }) => {
  const now = useDisplayNow(250);
  const seconds = timerState?.isRunning && timerState.startTime
    ? Math.max(0, timerState.seconds - (now - timerState.startTime) / 1000)
    : timerState?.seconds ?? 0;
  const isUrgent = Boolean(timerState?.isRunning && seconds > 0 && seconds < 60);
  const isCritical = Boolean(timerState?.isRunning && seconds > 0 && seconds < 30);
  const urgencyDuration = `${Math.max(0.12, 0.12 + (seconds / 60) * 1.38)}s`;
  const style = {
    ...(fontSize ? { fontSize } : {}),
    ...(isUrgent ? {
      display: 'inline-block',
      animation: `${isCritical ? 'critical-pulse' : 'urgency-pulse'} var(--urgency-duration) infinite ease-in-out, urgency-shake var(--urgency-duration) infinite ease-in-out`,
      '--urgency-duration': urgencyDuration,
      '--shake-intensity': `${Math.max(0, Math.min(6, (60 - seconds) / 10))}px`,
    } : {}),
  } as React.CSSProperties;
  const colorClass = isUrgent ? 'text-red-500 font-bold' : timerState?.isRunning ? 'text-emerald-400' : 'text-white/70';
  return <span className={`${className} ${colorClass}`} style={style}>
    {`${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`}
  </span>;
});

function App() {
  const lastAutoSnapshotTimeRef = useRef<number>(0);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isSyncTroubleshooterOpen, setIsSyncTroubleshooterOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isBTActive, setIsBTActive] = useState(false);
  const [state, setState] = useState<AppState>({
    currentScenario: INITIAL_SCENARIO,
    currentPhaseId: INITIAL_SCENARIO.phases[0]?.id || '',
    previewPhaseId: INITIAL_SCENARIO.phases[0]?.id || '',
    isPlaying: {},
    volume: 0.8,
    isDucking: false,
    timerStates: {},
    isEditorMode: getAppWindowMode(window.location.pathname) === 'edit',
    isPaused: false,
    phaseResults: {},
    phaseDurations: {},
    usedSounds: new Set(),
    exitTime: '',
    activeImageId: null,
    gmActiveImageId: null,
    syncConfig: {
      timerEnabled: true,
      contentEnabled: true,
      timerSize: 'small',
      timerPosition: 'bottom',
      imageFit: 'cover',
      activeImageId: null,
      timerForceHidden: false,
      lapDisplayMode: 'overlay',
      lapDisplayPosition: 'top',
    },
    pdfPageStates: {},
  });

  const [activeTimerIndex, setActiveTimerIndex] = useState(0);

  const setEditorMode = useCallback((isEditor: boolean, navigation: 'push' | 'replace' = 'push') => {
    const mode = isEditor ? 'edit' : 'session';
    const nextUrl = buildAppWindowUrl(mode, window.location.search, window.location.hash);

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      const historyState = { ...window.history.state, cuebookWindow: mode };
      if (navigation === 'replace') window.history.replaceState(historyState, '', nextUrl);
      else window.history.pushState(historyState, '', nextUrl);
    }

    setState(previousState => previousState.isEditorMode === isEditor
      ? previousState
      : { ...previousState, isEditorMode: isEditor });
  }, []);

  const toggleEditorMode = useCallback(() => {
    setEditorMode(!state.isEditorMode);
  }, [setEditorMode, state.isEditorMode]);

  useEffect(() => {
    const handlePopState = () => {
      const isEditor = getAppWindowMode(window.location.pathname) === 'edit';
      setState(previousState => previousState.isEditorMode === isEditor
        ? previousState
        : { ...previousState, isEditorMode: isEditor });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentPhase = useMemo(() => 
    (state.currentScenario.phases || []).find(p => p.id === state.currentPhaseId) || (state.currentScenario.phases || [])[0],
    [state.currentScenario.phases, state.currentPhaseId]
  );
  
  const activeTimer = useMemo(() => 
    currentPhase?.timers?.[activeTimerIndex] || currentPhase?.timers?.[0],
    [currentPhase, activeTimerIndex]
  );

  const activeTimerState = useMemo(() => 
    activeTimer ? (state.timerStates[activeTimer.id] || { seconds: activeTimer.durationMinutes * 60, isRunning: false, startTime: null }) : null,
    [activeTimer, state.timerStates]
  );

  const themeColor = useMemo(() => 
    state.currentScenario.themeColor || '#1e50a2',
    [state.currentScenario.themeColor]
  );

  const { backupData, setBackupData, showRecoveryModal, setShowRecoveryModal } = useSessionRecovery(isReady, state);

  const onToggleTimer = useCallback((phaseOrTimerId?: string) => {
    let tid = phaseOrTimerId || activeTimer?.id;
    if (!tid) return;
    tid = String(tid);

    // Resolve to the first timer ID of the phase if a phase ID is provided
    const phases = state.currentScenario.phases || [];
    const matchedPhase = phases.find(p => p.id === tid);
    if (matchedPhase) {
      tid = String(matchedPhase.timers?.[0]?.id || '');
    }

    if (!tid) return;

    const tState = state.timerStates[tid] || (() => {
      if (typeof tid === 'string' && tid.endsWith('-target')) {
        const pId = tid.replace('-target', '');
        const p = phases.find(x => x.id === pId);
        const targetMin = p ? (p.targetDurationMinutes || p.timeMinutes || 5) : 5;
        return { seconds: targetMin * 60, isRunning: false, startTime: null };
      }
      const timer = phases.flatMap(p => p.timers || []).find(t => t.id === tid);
      return timer ? { seconds: timer.durationMinutes * 60, isRunning: false, startTime: null } : null;
    })();

    if (!tState) return;

    audioService.activateAudio(state.currentScenario.title);
    const isRunning = !tState.isRunning;

    // Trigger tactile confirmation vibration on state transition if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (isRunning) {
        // Start: Double short buzzes
        navigator.vibrate([40, 40, 40]);
      } else {
        // Stop: Single medium buzz
        navigator.vibrate(80);
      }
    }
    
    let newSeconds = tState.seconds;
    const newStartTime = isRunning ? Date.now() : null;

    // If we are pausing, we need to capture the current elapsed time into seconds
    if (!isRunning && tState.startTime) {
      const elapsed = (Date.now() - tState.startTime) / 1000;
      newSeconds = Math.max(0, tState.seconds - elapsed);
    }
    
    setState(prev => ({ 
      ...prev, 
      timerStates: { 
        ...prev.timerStates, 
        [tid]: { 
          ...tState, 
          isRunning,
          startTime: newStartTime,
          seconds: newSeconds
        } 
      } 
    }));
  }, [activeTimer, state.timerStates, state.currentScenario.phases, state.currentScenario.title, setState]);

  const onResetTimer = useCallback((phaseOrTimerId?: string) => {
    let tid = phaseOrTimerId || activeTimer?.id;
    if (!tid) return;
    tid = String(tid);

    const phases = state.currentScenario.phases || [];
    const matchedPhase = phases.find(p => p.id === tid);
    let durationMinutes = activeTimer?.durationMinutes || 5;

    if (matchedPhase) {
      tid = String(matchedPhase.timers?.[0]?.id || '');
      durationMinutes = matchedPhase.timers?.[0]?.durationMinutes || 5;
    } else {
      if (typeof tid === 'string' && tid.endsWith('-target')) {
        const pId = tid.replace('-target', '');
        const p = phases.find(x => x.id === pId);
        durationMinutes = p ? (p.targetDurationMinutes || p.timeMinutes || 5) : 5;
      } else {
        const foundTimer = phases.flatMap(p => p.timers || []).find(t => t.id === tid);
        if (foundTimer) {
          durationMinutes = foundTimer.durationMinutes;
        }
      }
    }

    if (!tid) return;

    setState(prev => ({ 
      ...prev, 
      timerStates: { 
        ...prev.timerStates, 
        [tid]: { 
          seconds: durationMinutes * 60, 
          isRunning: false,
          startTime: null
        } 
      } 
    }));
  }, [activeTimer, state.currentScenario.phases, setState]);

  const onAdjustTimer = useCallback((delta: number) => {
    if (!activeTimer) return;
    setState(prev => {
      const current = prev.timerStates[activeTimer.id];
      if (!current) return prev;
      let currentSeconds = current.seconds;
      if (current.isRunning && current.startTime) {
        const elapsed = (Date.now() - current.startTime) / 1000;
        currentSeconds = Math.max(0, currentSeconds - elapsed);
      }
      return { 
        ...prev, 
        timerStates: { 
          ...prev.timerStates, 
          [activeTimer.id]: { 
            ...current, 
            seconds: Math.max(0, currentSeconds + delta),
            startTime: current.isRunning ? Date.now() : null
          } 
        } 
      };
    });
  }, [activeTimer]);

  const [mobileTab, setMobileTab] = useState<MobileTab>('script');
  const [columnFocus, setColumnFocus] = useState<ColumnFocus>('left');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState<'guide' | 'characters'>('guide');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSoundboardCollapsed, setIsSoundboardCollapsed] = useState(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const [resetStep, setResetStep] = useState<'select' | 'confirm_app' | 'confirm_scenario'>('select');
  const [showPreferences, setShowPreferences] = useState(false);
  const [showLoginConfirmation, setShowLoginConfirmation] = useState(false);
  const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [handoutCharacterId, setHandoutCharacterId] = useState<string | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<Performance[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [lastError, setLastError] = useState<{code: string; message: string} | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => checkQuotaInitial());
  const [isTimerDropdownOpen, setIsTimerDropdownOpen] = useState(false);
  const timerDropdownRef1 = useRef<HTMLDivElement>(null);
  const timerDropdownRef2 = useRef<HTMLDivElement>(null);
  const [isPhaseSearchOpen, setIsPhaseSearchOpen] = useState(false);

  const [migrationToast, setMigrationToast] = useState<{
    show: boolean;
    title: string;
    description: string;
    type: 'success' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    if (migrationToast?.show) {
      const timer = setTimeout(() => {
        setMigrationToast(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [migrationToast]);

  const layoutMode = useMemo(() => {
    const preset = state.currentScenario.layoutPreset || 'auto';
    if (preset === 'pc') return '3-column';
    if (preset === 'tablet') return '2-column';
    if (preset === 'mobile') return '1-column';
    if (preset === 'manual') {
      return state.currentScenario.columnLayoutMode || '3-column';
    }
    // 'auto' or unspecified:
    if (windowSize.width < 768) return '1-column';
    if (windowSize.width < 1024) return '2-column';
    return '3-column';
  }, [state.currentScenario.layoutPreset, state.currentScenario.columnLayoutMode, windowSize.width]);

  const isSpecialExtendedLayout = false;

  const progressNavPosition = useMemo(() => {
    if (state.currentScenario.progressNavPosition) return state.currentScenario.progressNavPosition;
    if (layoutMode === '3-column') return 'sidebar';
    return 'disabled';
  }, [layoutMode, state.currentScenario.progressNavPosition]);

  const isTabletVertical = false;

  // Beautiful horizontal drag-to-scroll controller for Phase elements
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const handleMouseDown = (e: MouseEvent) => {
      // Direct clicks on sub-elements shouldn't block native action unless dragging starts
      isDown = true;
      el.classList.remove('scroll-smooth'); // Disable temporarily for responsive dragging
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const handleMouseLeave = () => {
      isDown = false;
    };

    const handleMouseUp = () => {
      isDown = false;
      el.classList.add('scroll-smooth');
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.5; // Drag speed multiplier
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener('mousedown', handleMouseDown);
    el.addEventListener('mouseleave', handleMouseLeave);
    el.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mousemove', handleMouseMove);

    // Touch support for older/non-native layers
    let touchStartX = 0;
    let touchScrollLeft = 0;

    const handleTouchStart = (e: TouchEvent) => {
      isDown = true;
      el.classList.remove('scroll-smooth');
      touchStartX = e.touches[0].pageX - el.offsetLeft;
      touchScrollLeft = el.scrollLeft;
    };

    const handleTouchEnd = () => {
      isDown = false;
      el.classList.add('scroll-smooth');
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - el.offsetLeft;
      const walk = (x - touchStartX) * 1.2;
      el.scrollLeft = touchScrollLeft - walk;
    };

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      el.removeEventListener('mouseleave', handleMouseLeave);
      el.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const showTopVolume = useMemo(() => 
    (state.currentScenario.masterVolumePosition === 'top' || !state.currentScenario.masterVolumePosition) && 
    layoutMode !== '1-column' && 
    !isTabletVertical
  , [state.currentScenario.masterVolumePosition, layoutMode, isTabletVertical]);

  const [isPhasePopupOpen, setIsPhasePopupOpen] = useState<boolean>(false);
  const [isSoundPopupOpen, setIsSoundPopupOpen] = useState<boolean>(false);

  // Local videos hook
  const { combinedImages: fallbackMedia } = useLocalVideos(state.currentScenario.images || []);
  const combinedImages = useMemo(
    () => selectSyncMedia(state.currentScenario.playerImages, fallbackMedia),
    [state.currentScenario.playerImages, fallbackMedia]
  );

  // Floating timer hook
  const {
    timerDocked,
    setTimerDocked,
    timerX,
    timerY,
    dragConstraints,
    timerRef,
    dragX,
    dragY,
    isTimerOutOfWindow,
    isNearDock,
    handleTimerDragStart,
    handleTimerDrag,
    handleTimerDragEnd,
  } = useFloatingTimer(
    windowSize,
    isSpecialExtendedLayout,
    state.isEditorMode,
    isSoundboardCollapsed,
    layoutMode,
    state.currentScenario.timerDisplayPosition
  );

  const handleDockedDragStart = handleTimerDragStart;

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      setLastError({ code: 'ERR_RUNTIME', message: e.message });
    };
    window.addEventListener('error', handleError);

    // Register quota error listener
    setOnQuotaExceededListener(() => {
      setIsQuotaExceeded(true);
    });

    return () => {
      window.removeEventListener('error', handleError);
      setOnQuotaExceededListener(null);
    };
  }, []);

  useEffect(() => {
    if (user && !isQuotaExceeded) {
      // Sync performance history
      const q = query(
        collection(db, 'users', user.uid, 'performances'),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Performance));
        setPerformanceHistory(history);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/performances`);
      });
      return () => unsubscribe();
    }
  }, [user, isQuotaExceeded]);

  useEffect(() => {
    let lastWidth = window.innerWidth;
    let lastHeight = window.innerHeight;

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const widthChanged = Math.abs(w - lastWidth) > 0;
      const heightChanged = Math.abs(h - lastHeight) > 100;

      if (widthChanged || heightChanged) {
        lastWidth = w;
        lastHeight = h;
        setWindowSize({ width: w, height: h });
      }
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // UI Scaling Logic
  useEffect(() => {
    const mode = state.currentScenario.uiScaleMode || 'medium';
    const size = mode === 'small' ? '12.5px' : mode === 'large' ? '17.5px' : '15px';
    document.documentElement.style.fontSize = size;
  }, [state.currentScenario.uiScaleMode]);

  // scenario loading and synchronization are managed by useSyncEngine hook below

  const activateAudioWithPrefs = useCallback(() => {
    const mode = state.currentScenario.audioPreferences?.preventSleepMode || 'silent-wav';
    if (mode !== 'disabled') {
      audioService.activateAudio(state.currentScenario.title, mode as 'silent-wav' | 'white-noise');
    }
  }, [state.currentScenario.title, state.currentScenario.audioPreferences]);

  const { handleStopSound, handlePlaySound, handleToggleSound } = useAudioController(state, setState, activateAudioWithPrefs);

  const previewPhase = useMemo(() => 
    (state.currentScenario.phases || []).find(p => p.id === state.previewPhaseId) || (state.currentScenario.phases || [])[0],
    [state.currentScenario.phases, state.previewPhaseId]
  );

  const { syncData } = useSyncEngine({
    user,
    state,
    setState,
    isReady,
    setIsReady,
    activeTimerIndex,
    currentPhase
  });

  // Legacy scenarios receive a new persistent capability before any Firestore sync is attempted.
  useEffect(() => {
    if (!user || isSecureShareId(state.currentScenario.syncShareId)) return;
    const migrationId = window.setTimeout(() => {
      const shareId = createSecureShareId();
      setState(previousState => {
        if (isSecureShareId(previousState.currentScenario.syncShareId)) return previousState;
        return {
          ...previousState,
          currentScenario: { ...previousState.currentScenario, syncShareId: shareId }
        };
      });
    }, 0);
    return () => window.clearTimeout(migrationId);
  }, [user, state.currentScenario.syncShareId]);

  const handleControlVideo = useCallback((
    videoId: string | null, 
    action: 'play' | 'pause' | 'seek' | 'stop', 
    time?: number
  ) => {
    const sessionId = user && isSecureShareId(state.currentScenario.syncShareId)
      ? createTimerSessionId(user.uid, state.currentScenario.syncShareId)
      : null;
    
    const mediaItem = videoId 
      ? (combinedImages || []).find(img => 
          (img.id && String(img.id).trim() === String(videoId).trim()) ||
          (img.name && String(img.name).trim() === String(videoId).trim()) ||
          (img.url && String(img.url).trim() === String(videoId).trim())
        )
      : null;

    const targetMediaId = action === 'stop' ? null : videoId;
    const targetImageConfig = targetMediaId ? (state.syncConfig?.imageConfigs?.[targetMediaId] || mediaItem) : null;
    const selectedTimerColor = targetMediaId 
      ? (targetImageConfig?.timerColor || state.syncConfig?.timerColor || 'white')
      : (state.syncConfig?.timerColor || 'white');
    const selectedOverlayType = targetMediaId
      ? (targetImageConfig?.overlayType || state.syncConfig?.overlayType || 'black')
      : (state.syncConfig?.overlayType || 'black');

    setState(s => {
      const config = s.syncConfig || {
        timerEnabled: true,
        contentEnabled: true,
        timerSize: 'small',
        timerPosition: 'bottom',
        imageFit: 'cover',
        activeImageId: null,
      };
      
      const newConfig = {
        ...config,
        activeImageId: targetMediaId,
        timerColor: selectedTimerColor,
        overlayType: selectedOverlayType,
        videoPlaying: action === 'play' ? true : action === 'pause' ? false : config.videoPlaying,
        videoProgress: time !== undefined ? time : config.videoProgress,
      };

      return {
        ...s,
        activeImageId: targetMediaId,
        syncConfig: newConfig
      };
    });

    if (!user || !sessionId) return;

    const currentTimer = currentPhase?.timers?.[activeTimerIndex] || currentPhase?.timers?.[0];
    const timerState = currentTimer ? state.timerStates[currentTimer.id] : null;

    const resolvedUrl = mediaItem?.url 
      ? transformDropboxUrl(mediaItem.url) 
      : (videoId && videoId.startsWith('http') ? transformDropboxUrl(videoId) : null);

    const mergedData: TimerSyncData = {
      scenarioId: state.currentScenario.id,
      phaseId: state.currentPhaseId,
      timerId: currentTimer?.id || '',
      remainingSeconds: timerState?.seconds || 0,
      isRunning: timerState?.isRunning || false,
      startTime: timerState?.startTime || null,
      label: currentTimer?.label || null,
      activeImageId: targetMediaId,
      activeImageUrl: action === 'stop' ? null : resolvedUrl,
      activeImageName: action === 'stop' ? null : (mediaItem?.name || null),
      activeResourceType: action === 'stop' ? null : (mediaItem?.type || 'image'),
      pdfPage: null,
      syncTimerEnabled: state.syncConfig?.timerEnabled ?? true,
      syncContentEnabled: state.syncConfig?.contentEnabled ?? true,
      timerSize: state.syncConfig?.timerSize || 'small',
      timerPosition: state.syncConfig?.timerPosition || 'bottom',
      imageFit: state.syncConfig?.imageFit || 'cover',
      timerForceHidden: state.syncConfig?.timerForceHidden ?? false,
      urgentShakeEnabled: state.syncConfig?.urgentShakeEnabled ?? true,
      timerColor: selectedTimerColor,
      overlayType: selectedOverlayType,
      imageConfigs: state.syncConfig?.imageConfigs,
      videoPlaying: action === 'play' ? true : action === 'pause' ? false : (syncData?.videoPlaying ?? false),
      videoProgress: time !== undefined ? time : (syncData?.videoProgress ?? 0),
      videoDuration: syncData?.videoDuration ?? 0,
      videoVolume: syncData?.videoVolume ?? 1,
      videoLoop: syncData?.videoLoop ?? false,
    };

    syncService.setTimerInstant(sessionId, mergedData);
  }, [user, state, currentPhase, activeTimerIndex, syncData, combinedImages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTimerIndex(0);
  }, [state.currentPhaseId]);

  useEffect(() => {
    const nextExpiry = Math.min(...Object.values(state.timerStates)
      .filter((timerState) => timerState.isRunning && timerState.startTime)
      .map((timerState) => timerState.startTime! + timerState.seconds * 1000));
    if (!Number.isFinite(nextExpiry)) return;

    const timeout = window.setTimeout(() => {
      const nowMs = Date.now();
      const expiredTimerIds = Object.entries(state.timerStates)
        .filter(([, timerState]) => timerState.isRunning && timerState.startTime && timerState.startTime + timerState.seconds * 1000 <= nowMs)
        .map(([timerId]) => timerId);
      if (expiredTimerIds.length === 0) return;

      setState((previousState) => {
        const currentNow = Date.now();
        const nextTimerStates = { ...previousState.timerStates };
        for (const [timerId, timerState] of Object.entries(previousState.timerStates)) {
          if (timerState.isRunning && timerState.startTime && timerState.startTime + timerState.seconds * 1000 <= currentNow) {
            nextTimerStates[timerId] = { ...timerState, seconds: 0, isRunning: false, startTime: null };
          }
        }
        return { ...previousState, timerStates: nextTimerStates };
      });

      if (state.currentScenario.timerEndSoundEnabled) {
        const soundUrl = state.currentScenario.timerEndSoundUrl || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav';
        expiredTimerIds.forEach((timerId) => {
          audioService.play({ id: `timer-end-${timerId}-${Date.now()}`, name: 'Timer End Notification', url: soundUrl, type: SoundType.SE, volume: 0.8 })
            .catch((error) => console.warn('[Timer] Failed to play end sound:', error));
        });
      }
    }, Math.max(0, nextExpiry - Date.now()) + 25);

    return () => window.clearTimeout(timeout);
  }, [state.timerStates, state.currentScenario.timerEndSoundEnabled, state.currentScenario.timerEndSoundUrl, setState]);

  // auto-saving to local storage is managed inside useSyncEngine

  useEffect(() => { 
    audioService.setStatusCallback((active) => setIsBTActive(active));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.isEditorMode) {
        e.preventDefault();
        e.returnValue = '編集中のシナリオデータが失われる可能性があります。本当に離れますか？';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.isEditorMode]);

  useEffect(() => {
    // Session status monitoring or other background tasks could go here
  }, []);

  const handleSetPdfPageState = useCallback((id: string, page: number) => {
    setState(prev => ({
      ...prev,
      pdfPageStates: {
        ...(prev.pdfPageStates || {}),
        [id]: page
      }
    }));
  }, []);

  const { 
    handlePhasePreview, 
    handlePhaseTransition, 
    handleStopPhase,
    handleCancelPhase 
  } = usePhaseManager(state, setState, handleToggleSound, setActiveScriptTab);

  const handleSetCompleted = useCallback((phaseId: string, completed: boolean) => {
    setState(prev => ({
      ...prev,
      currentScenario: {
        ...prev.currentScenario,
        phases: (prev.currentScenario.phases || []).map(p => 
          p.id === phaseId ? { ...p, isCompleted: completed } : p
        )
      }
    }));
  }, [setState]);

  // Scenario history stack for Editor Undo/Redo
  const [undoStack, setUndoStack] = useState<Scenario[]>([]);
  const [redoStack, setRedoStack] = useState<Scenario[]>([]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    
    setUndoStack(prevUndo => {
      const nextUndo = [...prevUndo];
      const previousState = nextUndo.pop();
      
      if (previousState) {
        setRedoStack(prevRedo => {
          const nextRedo = [...prevRedo, state.currentScenario];
          if (nextRedo.length > 50) nextRedo.shift();
          return nextRedo;
        });
        
        setState(prev => ({
          ...prev,
          currentScenario: previousState
        }));
      }
      return nextUndo;
    });
  }, [undoStack, state.currentScenario]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    setRedoStack(prevRedo => {
      const nextRedo = [...prevRedo];
      const nextState = nextRedo.pop();
      
      if (nextState) {
        setUndoStack(prevUndo => {
          const nextUndo = [...prevUndo, state.currentScenario];
          if (nextUndo.length > 50) nextUndo.shift();
          return nextUndo;
        });

        setState(prev => ({
          ...prev,
          currentScenario: nextState
        }));
      }
      return nextRedo;
    });
  }, [redoStack, state.currentScenario]);

  const historyStatus = useMemo(() => ({
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  }), [undoStack.length, redoStack.length]);

  const currentPhaseIndex = useMemo(() => {
    return (state.currentScenario.phases || []).findIndex(p => p.id === state.currentPhaseId);
  }, [state.currentScenario.phases, state.currentPhaseId]);

  const handleNextPhase = useCallback(() => {
    const phases = state.currentScenario.phases || [];
    if (currentPhaseIndex >= 0 && currentPhaseIndex < phases.length - 1) {
      const nextPhase = phases[currentPhaseIndex + 1];
      if (nextPhase) {
        handlePhaseTransition(nextPhase.id);
      }
    }
  }, [currentPhaseIndex, state.currentScenario.phases, handlePhaseTransition]);

  const handlePrevPhase = useCallback(() => {
    const phases = state.currentScenario.phases || [];
    if (currentPhaseIndex > 0) {
      const prevPhase = phases[currentPhaseIndex - 1];
      if (prevPhase) {
        handlePhaseTransition(prevPhase.id);
      }
    }
  }, [currentPhaseIndex, state.currentScenario.phases, handlePhaseTransition]);

  // Global Keyboard Shortcuts Hook
  useGlobalShortcuts({
    scenario: state.currentScenario,
    keyboardShortcuts: state.currentScenario.keyboardShortcuts,
    sounds: state.currentScenario.sounds,
    combinedImages,
    activeImageId: state.activeImageId,
    isEditorMode: state.isEditorMode,
    onSetEditorMode: setEditorMode,
    onToggleEditorMode: toggleEditorMode,
    onToggleTimer: () => onToggleTimer(),
    onResetTimer: () => onResetTimer(),
    onToggleSound: handleToggleSound,
    onPlaySound: handlePlaySound,
    onStopAllSounds: () => handleStopSound('all'),
    onControlVideo: handleControlVideo,
    onToggleSyncWindow: () => setShowSyncModal(prev => !prev),
    onNextPhase: handleNextPhase,
    onPrevPhase: handlePrevPhase,
    onToggleQuickActions: () => setIsQuickActionsOpen(prev => !prev),
    onTogglePhaseSearch: () => setIsPhaseSearchOpen(prev => !prev),
    canUndo: historyStatus.canUndo,
    canRedo: historyStatus.canRedo,
    onUndo: handleUndo,
    onRedo: handleRedo,
  });


  /**
   * 部分更新と完全置換をサポートする更新ハンドラ。
   * インポート時は完全置換、設定変更時はマージを行う。
   */
  const handleUpdateScenario = useCallback((update: Partial<Scenario> | Scenario) => {
    const isFullReplacement = !!(update.phases && update.sounds && update.title && (update as Scenario).id);
    
    if (isFullReplacement) {
      setUndoStack([]);
      setRedoStack([]);
    } else if (state.isEditorMode) {
      // Push current scenario to history stack for local editing modifications
      setUndoStack(prev => {
        const currentJson = JSON.stringify(state.currentScenario);
        if (prev.length > 0 && JSON.stringify(prev[prev.length - 1]) === currentJson) {
          return prev;
        }
        const next = [...prev, state.currentScenario];
        if (next.length > 50) next.shift();
        return next;
      });
      setRedoStack([]); // progressive change wipes out any future redos
    }

    let migratedScenario: Scenario | null = null;
    if (isFullReplacement) {
      migratedScenario = storageService.migrateScenarioData(update as Scenario);
      const migratedWithFlags = migratedScenario as unknown as { 
        _migrated?: boolean; 
        _migrationDetails?: { 
          timerMigrated?: boolean; 
          lapNotificationMigrated?: boolean; 
        } 
      };
      if (migratedWithFlags._migrated) {
        const details = migratedWithFlags._migrationDetails || {};
        let desc = "古いファイルを最新仕様（v0.86+）にマイグレーションしました。";
        if (details.timerMigrated && details.lapNotificationMigrated) {
          desc = "1フェーズ1タイマー制限に伴う複数タイマーの台本退避、および旧ラップ通知テキストの同期PL表示（オーバーレイ）への移行を実施しました。";
        } else if (details.timerMigrated) {
          desc = "1フェーズ1タイマー制限に伴い、2番目以降のタイマー情報を台本末尾にメモとして退避しました。";
        } else if (details.lapNotificationMigrated) {
          desc = "旧仕様のラップ通知テキストを、最新の同期PL表示（オーバーレイ）へ自動的に移行しました。";
        }
        setMigrationToast({
          show: true,
          title: "データマイグレーション実行",
          description: desc,
          type: "warning"
        });
      }
    }

    setState(prev => {
      // 完全置換（インポート）の判定: 
      // 必須となる複数のキー(phases, sounds, title等)がすべて存在し、かつ Partial ではない場合のみ置換とする。
      const isFullReplacementComputed = !!(update.phases && update.sounds && update.title && (update as Scenario).id && (update as Scenario).id !== prev.currentScenario.id);
      
      if (isFullReplacementComputed) {
        audioService.stopAll();
        const activeScenario = migratedScenario || storageService.migrateScenarioData(update as Scenario);
        const initialTimers: Record<string, { seconds: number; isRunning: boolean }> = {};
        const phasesWithBlocks = (activeScenario.phases || []).map(p => ({
          ...p,
          scriptBlocks: p.scriptBlocks || (p.script ? [{ id: 'migrated-1', type: 'markdown', content: p.script }] : [])
        }));
        
        phasesWithBlocks.forEach((p: Phase) => {
          const targetMin = p.targetDurationMinutes || p.timeMinutes || 0;
          if (targetMin > 0) {
            initialTimers[`${p.id}-target`] = { seconds: targetMin * 60, isRunning: false };
          }
          (p.timers || []).forEach(t => {
            initialTimers[t.id] = { seconds: t.durationMinutes * 60, isRunning: false };
          });
        });

        return {
          ...prev,
          currentScenario: { ...activeScenario, phases: phasesWithBlocks },
          currentPhaseId: (phasesWithBlocks || [])[0]?.id || '',
          previewPhaseId: (phasesWithBlocks || [])[0]?.id || '',
          isPlaying: {},
          timerStates: initialTimers,
          sessionStartTime: undefined,
          phaseStartTime: undefined,
          phaseResults: {},
          activeImageId: null,
          volume: prev.volume,
          isDucking: false,
          pdfPageStates: {},
          syncConfig: activeScenario.syncConfig || prev.syncConfig
        };
      } else {
        // 5分経過していたら、バックアップスナップショットを静かに（サイレントに）追加
        let updatedSnapshots = prev.currentScenario.snapshots || [];
        const nowMs = Date.now();
        const lastTime = lastAutoSnapshotTimeRef.current;
        
        if (prev.isEditorMode) {
          if (lastTime === 0) {
            // 初回変更時は打刻のみ行い、5分後に備える
            lastAutoSnapshotTimeRef.current = nowMs;
          } else if (nowMs - lastTime >= 300000) {
            const date = new Date(nowMs);
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            
            const newSnapshot: ScenarioSnapshot = {
              id: uuidv4(),
              label: `[自動保存] ${timeStr}`,
              timestamp: nowMs,
              scenarioData: { ...prev.currentScenario }
            };
            
            updatedSnapshots = addSmartSnapshot(prev.currentScenario.snapshots || [], newSnapshot);
            lastAutoSnapshotTimeRef.current = nowMs;
          }
        }

        // 設定変更（部分更新）の場合：既存データを維持しつつ変更点のみ適用
        // 音源のリストが更新された場合、再生中の音源の音量を同期させる
        if (update.sounds) {
          update.sounds.forEach(s => {
            audioService.updateVolume(s.id, s.volume ?? 1.0);
          });
        }
        return {
          ...prev,
          currentScenario: {
            ...prev.currentScenario,
            ...update,
            snapshots: updatedSnapshots,
            lastUpdated: nowMs
          },
          syncConfig: update.syncConfig ? { ...prev.syncConfig, ...update.syncConfig } : prev.syncConfig
        };
      }
    });
  }, [state.isEditorMode, state.currentScenario]);

  const handleUpdateSoundConfig = useCallback((soundId: string, updates: Partial<SoundConfig>) => {
    if (updates.volume !== undefined) {
      audioService.updateVolume(soundId, updates.volume);
    }
    setState(prev => ({
      ...prev,
      currentScenario: {
        ...prev.currentScenario,
        sounds: (prev.currentScenario.sounds || []).map(s => s.id === soundId ? { ...s, ...updates } : s),
        lastUpdated: Date.now()
      }
    }));
  }, []);

  const handleReorderSounds = useCallback((newSounds: SoundConfig[]) => {
    setState(prev => ({
      ...prev,
      currentScenario: {
        ...prev.currentScenario,
        sounds: newSounds,
        lastUpdated: Date.now()
      }
    }));
  }, []);

  const handleMasterVolumeChange = useCallback((v: number) => {
    setState(prev => ({ ...prev, volume: v }));
  }, []);

  const handleStartSession = useCallback(() => {
    activateAudioWithPrefs();
    const now = Date.now();
    setState(prev => ({ 
      ...prev, 
      sessionStartTime: now, 
      phaseStartTime: now, 
      isPaused: false, 
      phaseResults: {}
    }));
  }, [activateAudioWithPrefs]);

  const handleTogglePause = useCallback(() => {
    setState(prev => {
      const newPaused = !prev.isPaused;
      const nextTimerStates = { ...prev.timerStates };
      const nowMs = Date.now();

      Object.entries(nextTimerStates).forEach(([id, tState]) => {
        if (!tState) return;
        if (newPaused) {
          if (tState.isRunning) {
            let newSeconds = tState.seconds;
            if (tState.startTime) {
              const elapsed = (nowMs - tState.startTime) / 1000;
              newSeconds = Math.max(0, tState.seconds - elapsed);
            }
            nextTimerStates[id] = {
              ...tState,
              isRunning: false,
              startTime: null,
              seconds: newSeconds
            };
          }
        }
      });

      return { ...prev, isPaused: newPaused, timerStates: nextTimerStates };
    });
  }, []);

  const handleConfirmEndSession = useCallback(() => {
    // localStorage.removeItem('cuebook_session_backup'); // Session recovery disabled
    const currentUser = auth.currentUser;
    if (currentUser) {
      const shareId = state.currentScenario.syncShareId;
      if (isSecureShareId(shareId)) syncService.clearSession(createTimerSessionId(currentUser.uid, shareId));
    }
    setState(prev => {
      const nextTimerStates = { ...prev.timerStates };
      Object.keys(nextTimerStates).forEach(id => { nextTimerStates[id] = { ...nextTimerStates[id], isRunning: false }; });
      const resetPhases = (prev.currentScenario.phases || []).map(p => ({
        ...p,
        checklistResults: undefined,
        isCompleted: false
      }));
      return { 
        ...prev, 
        sessionStartTime: undefined, 
        phaseStartTime: undefined, 
        isPaused: false, 
        phaseResults: {}, 
        timerStates: nextTimerStates,
        activeImageId: null,
        currentScenario: { ...prev.currentScenario, phases: resetPhases }
      };
    });
    setShowEndConfirmation(false);
  }, [state.currentScenario.syncShareId]);

  const handleResetSession = useCallback(() => {
    const confirmReset = window.confirm("セッションの進行状態（各フェーズの完了、タイマー、進捗など）のみをリセットしますか？\n※シナリオデータ（台本内容やサウンド設定など）は消去されません。");
    if (!confirmReset) return;

    const currentUser = auth.currentUser;
    if (currentUser) {
      const shareId = state.currentScenario.syncShareId;
      if (isSecureShareId(shareId)) syncService.clearSession(createTimerSessionId(currentUser.uid, shareId));
    }

    setState(prev => {
      const nextTimerStates: Record<string, { seconds: number; isRunning: boolean; startTime?: number | null }> = {};
      const phases = prev.currentScenario.phases || [];
      phases.forEach(p => {
        const targetMin = p.targetDurationMinutes || p.timeMinutes || 0;
        if (targetMin > 0) {
          nextTimerStates[`${p.id}-target`] = {
            seconds: targetMin * 60,
            isRunning: false,
            startTime: null
          };
        }
        (p.timers || []).forEach(t => {
          nextTimerStates[t.id] = {
            seconds: t.durationMinutes * 60,
            isRunning: false,
            startTime: null
          };
        });
        // Fallback compatibility (if there are no individual sub-timers)
        if (!p.timers || p.timers.length === 0) {
          const defaultDuration = p.timeMinutes || 5;
          nextTimerStates[p.id] = {
            seconds: defaultDuration * 60,
            isRunning: false,
            startTime: null
          };
        }
      });

      const resetPhases = phases.map(p => ({
        ...p,
        checklistResults: undefined,
        isCompleted: false
      }));

      const firstPhaseId = resetPhases[0]?.id || '';

      return {
        ...prev,
        currentPhaseId: firstPhaseId,
        previewPhaseId: firstPhaseId,
        sessionStartTime: undefined,
        phaseStartTime: undefined,
        isPaused: false,
        phaseResults: {},
        timerStates: nextTimerStates,
        activeImageId: null,
        gmActiveImageId: null,
        currentScenario: { ...prev.currentScenario, phases: resetPhases }
      };
    });
  }, [state.currentScenario, setState]);

  const handleAppReset = useCallback(async () => {
    // 誤操作救済として、初期化直前のシナリオをスナップショットとしてINITIAL_SCENARIOに引き継ぎマージします
    const nowMs = Date.now();
    const date = new Date(nowMs);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    const preResetSnapshot: ScenarioSnapshot = {
      id: uuidv4(),
      label: `[自動: アプリ初期化前] ${timeStr}`,
      timestamp: nowMs,
      scenarioData: { ...state.currentScenario }
    };
    
    const originalSnapshots = state.currentScenario.snapshots || [];
    const mergedSnapshots = addSmartSnapshot(originalSnapshots, preResetSnapshot);
    
    const targetInitialScenario = {
      ...INITIAL_SCENARIO,
      snapshots: mergedSnapshots
    };

    // 1. Clear IndexedDB
    try {
      await storageService.saveScenario('gm_accomplice_scenario', targetInitialScenario);
    } catch (e) {
      console.error("IndexedDB reset failed:", e);
    }

    // 2. Clear localStorage keys starting with cuebook_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cuebook_')) {
          localStorage.removeItem(key);
          // adjust pointer since we removed an item
          i--;
        }
      }
    } catch (e) {
      console.error("LocalStorage reset failed:", e);
    }

    // 3. Reset React App State completely
    setState({
      currentScenario: targetInitialScenario,
      currentPhaseId: targetInitialScenario.phases[0]?.id || '',
      previewPhaseId: targetInitialScenario.phases[0]?.id || '',
      isPlaying: {},
      volume: 0.8,
      isDucking: false,
      timerStates: {},
      isEditorMode: getAppWindowMode(window.location.pathname) === 'edit',
      isPaused: false,
      phaseResults: {},
      phaseDurations: {},
      usedSounds: new Set(),
      exitTime: '',
      activeImageId: null,
      gmActiveImageId: null,
      syncConfig: {
        timerEnabled: true,
        contentEnabled: true,
        timerSize: 'small',
        timerPosition: 'bottom',
        imageFit: 'cover',
        activeImageId: null,
        timerForceHidden: false,
      },
      pdfPageStates: {},
    });

    setActiveTimerIndex(0);
    setShowResetConfirmation(false);
    setResetStep('select');
  }, [state.currentScenario]);

  const handleScenarioReset = useCallback(async () => {
    // Resets current scenario to BLANK_SCENARIO
    // 誤操作救済として、リセット直前のシナリオをスナップショットとしてBLANK_SCENARIOに引き継ぎマージします
    const nowMs = Date.now();
    const date = new Date(nowMs);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    const preResetSnapshot: ScenarioSnapshot = {
      id: uuidv4(),
      label: `[自動: リセット直前] ${timeStr}`,
      timestamp: nowMs,
      scenarioData: { ...state.currentScenario }
    };
    
    const originalSnapshots = state.currentScenario.snapshots || [];
    const mergedSnapshots = addSmartSnapshot(originalSnapshots, preResetSnapshot);
    
    const targetBlankScenario = {
      ...BLANK_SCENARIO,
      snapshots: mergedSnapshots
    };

    try {
      await storageService.saveScenario('gm_accomplice_scenario', targetBlankScenario);
    } catch (e) {
      console.error("IndexedDB reset failed:", e);
    }

    setState(prev => ({
      ...prev,
      currentScenario: targetBlankScenario,
      currentPhaseId: targetBlankScenario.phases[0]?.id || 'phase-01',
      previewPhaseId: targetBlankScenario.phases[0]?.id || 'phase-01',
      isPlaying: {},
      isPaused: false,
      activeImageId: null,
      gmActiveImageId: null,
      phaseResults: {},
      pdfPageStates: {},
      timerStates: {},
    }));

    setActiveTimerIndex(0);
    setShowResetConfirmation(false);
    setResetStep('select');
  }, [state.currentScenario]);

  const handleUpdateCharacter = useCallback((charId: string, updates: Partial<Character>) => {
    setState(prev => ({
      ...prev,
      currentScenario: {
        ...prev.currentScenario,
        characters: (prev.currentScenario.characters || []).map(c => c.id === charId ? { ...c, ...updates } : c)
      }
    }));
  }, []);

  const handleToggleChecklist = useCallback((phaseId: string, index: number) => {
    setState(prev => {
      const updatedPhases = (prev.currentScenario.phases || []).map(p => {
        if (p.id === phaseId) {
          const results = [...(p.checklistResults || new Array(p.checklists?.length || 0).fill(false))];
          results[index] = !results[index];
          return { ...p, checklistResults: results };
        }
        return p;
      });
      return {
        ...prev,
        currentScenario: { ...prev.currentScenario, phases: updatedPhases }
      };
    });
  }, []);

  const handleShowImage = useCallback((id: string | null) => {
    setState(s => ({ 
      ...s, 
      gmActiveImageId: id
    }));
  }, []);

  const handleSyncImageToPlayers = useCallback((id: string | null) => {
    setState(s => {
      const targetId = id === null ? null : (id || s.gmActiveImageId);
      return { 
        ...s, 
        activeImageId: targetId,
        syncConfig: s.syncConfig ? { ...s.syncConfig, activeImageId: targetId } : s.syncConfig
      };
    });
  }, []);

  const handleOpenHandout = useCallback((id: string | null) => {
    if (id) {
      setState(previousState => {
        const character = previousState.currentScenario.characters.find(item => item.id === id);
        if (!character || isSecureShareId(character.handoutShareId)) return previousState;
        return {
          ...previousState,
          currentScenario: {
            ...previousState.currentScenario,
            characters: previousState.currentScenario.characters.map(item =>
              item.id === id ? { ...item, handoutShareId: createSecureShareId() } : item
            )
          }
        };
      });
    }
    setHandoutCharacterId(id);
  }, []);

  const handleUpdateSoundClusters = useCallback((clusters: SoundCluster[]) => {
    handleUpdateScenario({
      ...state.currentScenario,
      soundClusters: clusters
    });
  }, [state.currentScenario, handleUpdateScenario]);

  const handleOpenSync = useCallback(() => {
    setShowSyncModal(true);
  }, []);

  const handleExportZip = async (format: 'zip' | 'cuebook' = 'cuebook') => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const baseName = `${state.currentScenario.title}_ScenarioMaster_${dateStr}`;
    const zip = new JSZip();
    zip.file(`${baseName}.json`, JSON.stringify(state.currentScenario, null, 2));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.${format}`;
    a.click();
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,.cuebook';
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const fileName = String(file.name || '');
      try {
        if (fileName.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const jsonFile = Object.values(zip.files).find((f) => String(f?.name || '').endsWith('.json'));
          if (jsonFile) {
            const content = await jsonFile.async('string');
            handleUpdateScenario(JSON.parse(content));
          }
        } else if (fileName.endsWith('.json') || fileName.endsWith('.cuebook')) {
          const reader = new FileReader();
          reader.onload = (re) => {
            if (re.target?.result) {
              const data = JSON.parse(re.target.result as string);
              // Basic validation
              if (data && data.title && data.phases) {
                handleUpdateScenario(data);
              } else {
                alert("Invalid scenario data.");
              }
            }
          };
          reader.readAsText(file);
        }
      } catch (err) { 
        console.error("Import failed:", err);
        alert("Import failed. Please check the file format."); 
      }
    };
    input.click();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;
    const layout = getLayoutMode();
    
    if (layout === '1-column') {
      const threshold = 60; 
      // Y軸（縦スクロール）の移動よりX軸（横スワイプ）の移動の方が明らかに大きい場合のみ横スワイプ判定とする
      if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        if (diffX > 0) {
          if (mobileTab === 'phases') setMobileTab('script');
          else if (mobileTab === 'script') setMobileTab('audio');
        } else {
          if (mobileTab === 'audio') setMobileTab('script');
          else if (mobileTab === 'script') setMobileTab('phases');
        }
      }
    } else if (layout === '2-column') {
      // 2カラム（iPad縦）では縦スクロール時の軽微な横ぶれによる意図しないスワイプ誤判定を完全に防ぐため、
      // スコアの閾値を厳格化（スワイプ距離140px以上、かつ縦移動の3.5倍以上の純粋な横移動のみ検知）
      const threshold = 140;
      if (Math.abs(diffX) > threshold && Math.abs(diffX) > Math.abs(diffY) * 3.5) {
        if (diffX > 0) setColumnFocus('right');
        else setColumnFocus('left');
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const getLayoutMode = () => {
    return layoutMode;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Sync active timer to Firebase - Moved to useTimerSync

  const getShareTimerUrl = () => {
    if (!user) return "";
    let shareId = state.currentScenario.syncShareId;
    if (!isSecureShareId(shareId)) {
      shareId = createSecureShareId();
      const nextShareId = shareId;
      setState(previousState => ({
        ...previousState,
        currentScenario: isSecureShareId(previousState.currentScenario.syncShareId)
          ? previousState.currentScenario
          : { ...previousState.currentScenario, syncShareId: nextShareId }
      }));
    }
    const sessionId = createTimerSessionId(user.uid, shareId);
    return `${window.location.origin}${window.location.pathname}?view=timer&sessionId=${sessionId}`;
  };

  const quotaExceeded = useQuotaCheck();

  const handleResetSync = async () => {
    const shareId = state.currentScenario.syncShareId;
    if (!user || !isSecureShareId(shareId)) return;
    await syncService.resetTimerSession(createTimerSessionId(user.uid, shareId));
  };

  const handleLogin = () => {
    setShowLoginConfirmation(true);
  };

  const handleConfirmLogin = async () => {
    setShowLoginConfirmation(false);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleLogout = async () => {
    try {
      if (user) {
        const shareId = state.currentScenario.syncShareId;
        if (isSecureShareId(shareId)) syncService.clearSession(createTimerSessionId(user.uid, shareId));
      }
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  const handleSavePerformance = async (perfData: Omit<Performance, 'id' | 'timestamp'>) => {
    if (!user) return;
    if (isQuotaExceeded) {
      alert('現在クォータ制限を超過しているため、オンラインへの保存をスキップしました (ローカルセッションは継続動作します)。');
      setPerformanceModalOpen(false);
      handleConfirmEndSession();
      return;
    }
    try {
      await addDoc(collection(db, 'users', user.uid, 'performances'), {
        ...perfData,
        timestamp: Date.now()
      });
      setPerformanceModalOpen(false);
      handleConfirmEndSession();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/performances`);
      setPerformanceModalOpen(false);
      handleConfirmEndSession();
    }
  };

  const handleRemovePerformance = async (id: string) => {
    if (!user) return;
    if (isQuotaExceeded) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'performances', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/performances/${id}`);
    }
  };

  const handleRecoverSession = useCallback(async () => {
    if (backupData && backupData.state) {
      setState({
        ...backupData.state,
        isEditorMode: getAppWindowMode(window.location.pathname) === 'edit',
      });
      // Synchronize audio service or other side effects if needed
      if (backupData.state.volume !== undefined) {
        audioService.setVolume(backupData.state.volume);
      }
    }
    setShowRecoveryModal(false);
    setBackupData(null);
    await sessionRecoveryService.clearBackup();
  }, [backupData, setShowRecoveryModal, setBackupData]);

  const handleDiscardRecovery = useCallback(async () => {
    await sessionRecoveryService.clearBackup();
    setShowRecoveryModal(false);
    setBackupData(null);
  }, [setShowRecoveryModal, setBackupData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTimerDropdownOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (!isTimerDropdownOpen) return;
      const target = e.target as Node;
      const inRef1 = timerDropdownRef1.current?.contains(target);
      const inRef2 = timerDropdownRef2.current?.contains(target);
      if (!inRef1 && !inRef2) {
        setIsTimerDropdownOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isTimerDropdownOpen]);

  const queryParams = new URLSearchParams(window.location.search);
  const view = queryParams.get('view');
  const sessionId = queryParams.get('sessionId');

  if (view === 'timer' && sessionId) {
    return <TimerShareView sessionId={sessionId} themeColor={themeColor} />;
  }

  const handoutCid = queryParams.get('cid');
  const handoutSid = queryParams.get('sid');

  if (handoutCid && handoutSid) {
    return (
      <div className="h-[100dvh] w-screen bg-[#050505]">
        <PlayerHandoutLoader 
          characterId={handoutCid} 
          sessionId={handoutSid} 
          themeColor={themeColor} 
        />
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#050505] text-white">
        <Loader2 className="animate-spin text-red-700 mb-4" size={48} />
        <p className="font-cinzel tracking-[0.3em] text-white/40">Initializing Interface...</p>
      </div>
    );
  }

  const SIDEBAR_EXPANDED = 260;
  const AUDIO_EXPANDED = 320;
  const COLLAPSED_WIDTH = 60;

  const hasSidebar = progressNavPosition === 'sidebar';
  const sidebarWidthVal = !hasSidebar ? 0 : (isSidebarCollapsed ? COLLAPSED_WIDTH : SIDEBAR_EXPANDED);
  const soundboardWidthVal = isSoundboardCollapsed 
    ? COLLAPSED_WIDTH 
    : (state.currentScenario.narrowAudioPanel ? Math.floor(AUDIO_EXPANDED * 0.8) : AUDIO_EXPANDED);

  const getMiddlePanelWidth = () => {
    if (layoutMode === '3-column') {
      return `calc(100vw - ${sidebarWidthVal + soundboardWidthVal}px)`;
    }
    if (layoutMode === '2-column') {
      const activeSideWidth = columnFocus === 'left' ? sidebarWidthVal : soundboardWidthVal;
      return `calc(100vw - ${activeSideWidth}px)`;
    }
    return '100vw';
  };

  const middlePanelWidth = getMiddlePanelWidth();

  // Unused popup timer legacy logic cleaned for integrated docking.

  const renderTimerDropdown = () => (
    <AnimatePresence>
      {isTimerDropdownOpen && (
        <motion.div 
          initial={{ opacity: 0, y: layoutMode === '1-column' ? 10 : -10, x: "-50%", scale: 0.95 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: layoutMode === '1-column' ? 10 : -10, x: "-50%", scale: 0.95 }}
          className={`absolute ${layoutMode === '1-column' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 w-48 bg-[#0c0c0d]/98 border rounded-xl shadow-[0_25px_70px_rgba(0,0,0,0.9)] z-[9999] backdrop-blur-3xl p-1.5 cursor-default`}
          style={{ borderColor: themeColor + '1a', boxShadow: `0 25px 70px rgba(0,0,0,0.9), 0 0 20px ${themeColor}10` }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: themeColor + '3d', borderColor: themeColor + '80' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setIsTimerDropdownOpen(false);
              setShowSyncModal(true);
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
  );

  return (
    <div 
      className={`h-[100dvh] w-screen flex flex-col bg-[#050505] overflow-hidden select-none relative font-sans text-white/80 transition-all duration-300`}
      style={{ overscrollBehavior: 'none' }}
    >
      <div 
        className="fixed inset-0 z-0 opacity-35 pointer-events-none transition-opacity duration-500" 
        style={{ 
          backgroundImage: state.currentScenario.backgroundImage ? `url(${state.currentScenario.backgroundImage})` : 'none', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center' 
        }} 
      />
      
      {/* Quota Exceeded Alert */}
      <AnimatePresence>
        {isQuotaExceeded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-500 text-white overflow-hidden z-[200] shrink-0"
          >
            <div className="max-w-4xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="animate-pulse" />
                <span className="text-[10px] font-bold font-cinzel tracking-widest uppercase">
                  Firebase Quota Exceeded: 同期機能が一時的に停止しています (本日はこれ以上同期できません)
                </span>
              </div>
              <button 
                onClick={() => setIsQuotaExceeded(false)}
                className="p-1 hover:bg-black/10 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LiveHeader 
        title={state.currentScenario.title}
        themeColor={themeColor}
        isBTActive={isBTActive}
        isEditorMode={state.isEditorMode}
        volume={state.volume}
        isDucking={state.isDucking}
        showVolume={showTopVolume}
        onVolumeChange={(v) => setState(s => ({...s, volume: v}))}
        onToggleDucking={() => setState(s => ({...s, isDucking: !s.isDucking}))}
        onToggleEditor={toggleEditorMode}
        onExport={handleExportZip}
        onImport={handleImportFile}
        onReset={() => setShowResetConfirmation(true)}
        onResetSession={handleResetSession}
        onOpenSessionSummary={() => setShowSessionSummary(true)}
        phases={state.currentScenario.phases || []}
        currentPhaseId={state.currentPhaseId}
        phaseResults={state.phaseResults}
        scenarioName={state.currentScenario.title || "Untitled Scenario"}
        phaseStartTime={state.phaseStartTime}
        onOpenPreferences={() => setShowPreferences(true)}
        onOpenHistory={() => setHistoryModalOpen(true)}
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        exitTime={state.exitTime}
        onExitTimeChange={(time) => setState(s => ({ ...s, exitTime: time }))}
        // Timer props
        timerSeconds={activeTimerState?.seconds}
        isTimerRunning={activeTimerState?.isRunning}
        timerStartTime={activeTimerState?.startTime}
        timerLabel={state.syncConfig?.timerLabelText || activeTimer?.label}
        onToggleTimer={onToggleTimer}
        onResetTimer={onResetTimer}
        onAdjustTimer={onAdjustTimer}
        onPrevTimer={() => {
          const timerCount = (currentPhase?.timers || []).length;
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
          }
        }}
        onNextTimer={() => {
          const timerCount = (currentPhase?.timers || []).length;
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev + 1) % timerCount);
          }
        }}
        onMenuShowChange={setIsMenuOpen}
        totalTimers={(currentPhase?.timers || []).length}
        timerDisplayPosition={state.currentScenario.timerDisplayPosition}
        onOpenSync={() => setShowSyncModal(true)}
        quotaExceeded={quotaExceeded}
        customShortcuts={state.currentScenario.keyboardShortcuts}
      />

      {!state.isEditorMode && activeTimer && activeTimerState && layoutMode === '1-column' && (state.currentScenario.timerDisplayPosition === 'header' || state.currentScenario.timerDisplayPosition === 'both') && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#0a0a0b] border-b border-white/10 z-30 shrink-0">
           <div className="flex items-center gap-2 overflow-hidden">
             <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: themeColor }} />
             <span className="text-[10px] font-bold font-cinzel text-white/40 uppercase truncate">{state.syncConfig?.timerLabelText || activeTimer.label}</span>
           </div>
           <div className="flex items-center gap-4">
             <TimerCard 
               config={activeTimer}
               timerLabelText={state.syncConfig?.timerLabelText}
               seconds={activeTimerState.seconds}
               isRunning={activeTimerState.isRunning}
               startTime={activeTimerState.startTime}
               themeColor={themeColor}
               isCollapsed={true}
                timerFlashOnPauseEnabled={state.currentScenario.timerFlashOnPauseEnabled}
               onToggle={onToggleTimer}
               onReset={onResetTimer}
               onAdjust={onAdjustTimer}
             />
           </div>
        </div>
      )}

      {/* 統合ドラッグ＆ドックフローティングタイマー (v0.86 UI & UX Optimization) */}
      {layoutMode !== '1-column' && activeTimer && activeTimerState && !isMenuOpen && (!timerDocked || isSpecialExtendedLayout) && (
        <motion.div 
          ref={timerRef}
          drag
          dragConstraints={dragConstraints}
          dragMomentum={false}
          dragElastic={0}
          whileDrag={{ scale: 1.03, zIndex: 120, boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}
          onDragStart={handleTimerDragStart}
          onDrag={handleTimerDrag}
          onDragEnd={handleTimerDragEnd}
          className="fixed z-[100] w-[200px] cursor-grab active:cursor-grabbing touch-none shadow-[0_20px_50px_rgba(0,0,0,0.6)] bg-zinc-950/90 border-2 border-white/45 rounded-2xl backdrop-blur-md overflow-visible transition-[box-shadow] duration-300"
          style={{ 
            left: timerX,
            top: timerY,
            x: dragX,
            y: dragY
          }}
        >
          <TimerCard 
            config={activeTimer}
            timerLabelText={state.syncConfig?.timerLabelText}
            seconds={activeTimerState.seconds}
            isRunning={activeTimerState.isRunning}
            startTime={activeTimerState.startTime}
            themeColor={themeColor}
            totalTimers={(currentPhase?.timers || []).length}
            activeTimerIndex={activeTimerIndex}
            isCollapsed={false}
            isLoggedIn={!!user}
            onShare={getShareTimerUrl}
            onToggle={onToggleTimer}
            onReset={onResetTimer}
            onAdjust={onAdjustTimer}
            onOpenSyncModal={() => setShowSyncModal(true)}
            timerFlashOnPauseEnabled={state.currentScenario.timerFlashOnPauseEnabled}
            onSetDocked={setTimerDocked}
            onPrev={() => {
              const timerCount = (currentPhase?.timers || []).length;
              if (timerCount > 1) {
                setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
              }
            }}
            onNext={() => {
              const timerCount = (currentPhase?.timers || []).length;
              if (timerCount > 1) {
                setActiveTimerIndex(prev => (prev + 1) % timerCount);
              }
            }}
          />
        </motion.div>
      )}

      <main 
        className="flex-1 overflow-hidden z-10 relative h-full bg-black/20"
        onTouchStart={!state.isEditorMode ? handleTouchStart : undefined}
        onTouchEnd={!state.isEditorMode ? handleTouchEnd : undefined}
      >
        {state.isEditorMode ? (
          <div className="h-full w-full overflow-hidden">
            <React.Suspense fallback={
              <div className="h-full w-full flex flex-col items-center justify-center bg-[#050505] gap-4">
                <Loader2 className="animate-spin text-white/20" size={48} />
                <p className="text-[10px] font-cinzel text-white/20 uppercase tracking-[0.4em]">Loading Editor...</p>
              </div>
            }>
              <EditorView 
                scenario={state.currentScenario} 
                user={user}
                onUpdate={handleUpdateScenario} 
                currentPhaseId={state.currentPhaseId}
                onExport={handleExportZip}
                onImport={handleImportFile}
                canUndo={historyStatus.canUndo}
                canRedo={historyStatus.canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </React.Suspense>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col relative overflow-hidden">
            {progressNavPosition === 'top' && (
              <PhaseProgressNav
                scenario={state.currentScenario}
                activePhaseId={state.currentPhaseId}
                previewPhaseId={state.previewPhaseId}
                themeColor={themeColor}
                onPhasePreview={handlePhasePreview}
                onPhaseTransition={handlePhaseTransition}
                timerStates={state.timerStates}
                onToggleTimer={onToggleTimer}
                onStartSession={handleStartSession}
                onSetCompleted={handleSetCompleted}
                isPaused={state.isPaused || false}
                sessionStartTime={state.sessionStartTime}
                onOpenPhasePopup={() => setIsPhasePopupOpen(true)}
                position="top"
                onResetTimer={onResetTimer}
              />
            )}
            
            <div className="flex-1 min-h-0 w-full relative overflow-hidden">
              {(layoutMode as string) === 'manual' ? (
                /* --- EXPERIMENTAL LAYOUT A (Combined sliding layout) --- */
                <div 
                  className="flex h-full transition-transform duration-500 ease-out relative gap-0 flex-nowrap w-[200%]"
              style={{ 
                width: '200vw',
                transform: `translateX(${columnFocus === 'right' ? '-100vw' : '0px'})`
              }}
            >
              {/* PANEL 1: Combined Controller Console (PhaseSidebar + SoundBoard) */}
              <div className="w-[100vw] h-full flex flex-col md:flex-row relative shrink-0 divide-y md:divide-y-0 md:divide-x divide-white/5 border-r border-white/5 bg-[#050505] overflow-hidden">
                {/* Left/Upper portion: Phase Sidebar */}
                <div className="w-full md:w-[325px] h-[45%] md:h-full shrink-0 relative bg-black/20 overflow-hidden">
                  <PhaseSidebar 
                    scenario={state.currentScenario}
                    activePhaseId={state.currentPhaseId}
                    previewPhaseId={state.previewPhaseId}
                    themeColor={themeColor} 
                    onPhasePreview={handlePhasePreview}
                    onPhaseTransition={handlePhaseTransition}
                    onStopPhase={handleStopPhase}
                    onCancelPhase={handleCancelPhase}
                    sessionStartTime={state.sessionStartTime}
                    exitTime={state.exitTime}
                    onExitTimeChange={(time) => setState(s => ({ ...s, exitTime: time }))}
                    isPaused={state.isPaused || false}
                    phaseResults={state.phaseResults}
                    activePhaseStartTime={state.phaseStartTime}
                    onStartSession={handleStartSession}
                    onTogglePause={handleTogglePause}
                    isCollapsed={false}
                  />
                </div>

                {/* Right/Lower portion: SoundBoard */}
                <div className="flex-1 h-[55%] md:h-full overflow-hidden bg-[#070707]/60">
                  <SoundBoard 
                    sounds={state.currentScenario.sounds || []} 
                    isPlaying={state.isPlaying || {}} 
                    onToggleSound={handleToggleSound} 
                    onPlaySound={handlePlaySound}
                    onStopSound={handleStopSound}
                    onUpdateSoundConfig={handleUpdateSoundConfig}
                    onReorderSounds={handleReorderSounds}
                    recommendedIds={currentPhase?.recommendedSounds || []}
                    themeColor={themeColor}
                    masterVolume={state.volume}
                    onMasterVolumeChange={handleMasterVolumeChange}
                    showSideVolume={true}
                    isNarrow={state.currentScenario.narrowAudioPanel}
                    volumePosition="right-center"
                    images={combinedImages}
                    syncData={syncData}
                    onControlVideo={handleControlVideo}
                  />
                </div>
              </div>

              {/* PANEL 2: GM Guide (ScriptViewer) 1-column layout */}
              <div className="w-[100vw] h-full shrink-0 bg-[#070707] relative overflow-hidden">
                {previewPhase && (
                  <ScriptViewer 
                    phase={previewPhase} 
                    scenario={state.currentScenario}
                    scenarioTitle={state.currentScenario.title}
                    characters={state.currentScenario.characters || EMPTY_CHARACTERS}
                    onUpdateCharacter={handleUpdateCharacter}
                    isPreviewing={state.previewPhaseId !== state.currentPhaseId}
                    activeTab={activeScriptTab}
                    onTabChange={setActiveScriptTab}
                    onOpenHandout={handleOpenHandout}
                    activeImageId={state.activeImageId}
                    onShowImage={handleShowImage}
                    pdfPageStates={state.pdfPageStates || EMPTY_PDF_PAGE_STATES}
                    onSetPdfPageState={handleSetPdfPageState}
                    onOpenSync={handleOpenSync}
                    onUpdateScenario={handleUpdateScenario}
                  />
                )}
              </div>
            </div>
          ) : layoutMode === '2-column' || layoutMode === '1-column' ? (
            /* --- EXPERIMENTAL LAYOUT B / TABLET VERTICAL / NEW MOBILE (Integrated Cockpit) --- */
            <div
              className={`w-full h-full flex flex-col relative overflow-hidden ${
                layoutMode === '2-column' ? 'bg-transparent' : 'bg-[#060606]'
              }`}
            >
              {/* Top Navigation: Render progress management bar at top ONLY inside tablet portrait mode */}
              {layoutMode === '2-column' && (
                <div className="w-full h-16 bg-[#0a0a0b] border-b border-white/20 flex items-center justify-between px-3 md:px-5 shrink-0 z-50 select-none">
                  {/* Left Area: Horizontal scrollable Phase Card Track */}
                  <div 
                    ref={scrollRef}
                    className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 max-w-[70%] py-1 cursor-grab active:cursor-grabbing mr-4"
                    style={{ height: '50.75px', backgroundColor: 'transparent' }}
                  >
                    {(state.currentScenario.phases || []).map((phase, index) => {
                      const isActive = phase.id === state.currentPhaseId;
                      const isPreview = phase.id === state.previewPhaseId;
                      
                      const timerId = phase.timers?.[0]?.id || '';
                      const tState = state.timerStates[timerId];

                      const totalSecs = phase.timeMinutes ? (phase.timeMinutes * 60) : (phase.timers?.[0]?.durationMinutes ? phase.timers[0].durationMinutes * 60 : 300);
                      const runningSeconds = tState?.seconds ?? totalSecs;

                      return (
                        <PhaseCard
                          key={phase.id}
                          phase={phase}
                          index={index}
                          isActive={isActive}
                          isPreview={isPreview}
                          unlocked={true}
                          themeColor={themeColor}
                          runningSeconds={runningSeconds}
                          timerState={tState}
                          onPreview={handlePhasePreview}
                          onActivate={handlePhaseTransition}
                          onToggleTimer={onToggleTimer}
                          onSetCompleted={handleSetCompleted}
                          onOpenDetails={() => {
                            setIsPhasePopupOpen(true);
                            setIsSoundPopupOpen(false);
                          }}
                          onResetTimer={onResetTimer}
                        />
                      );
                    })}
                  </div>

                  {/* Center Area: Elegant Draggable Cockpit Clock & Timer (Timer Digits Only) */}
                  <div 
                    ref={timerDropdownRef1}
                    onClick={() => {
                      setIsTimerDropdownOpen(!isTimerDropdownOpen);
                      audioService.activateAudio(state.currentScenario.title);
                    }}
                    className={`relative flex items-center justify-center bg-zinc-950/80 border rounded-full px-5 py-2 hover:border-white/20 select-none shadow-xl cursor-pointer transition-all active:scale-95 shrink-0
                      ${activeTimerState?.isRunning ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]' : 'border-white/10'}`}
                    style={{ borderWidth: '0px' }}
                  >
                      <CompactTimerReadout timerState={activeTimerState} className="font-mono leading-none font-black tabular-nums tracking-wide transition-all duration-300" fontSize="38px" />
                      {renderTimerDropdown()}
                  </div>

                  {/* Right Area: Dynamic Audio Monitor Token Mixer Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="hidden md:inline text-[9px] font-black font-cinzel text-white/30 tracking-widest uppercase text-right">
                      {Object.values(state.isPlaying || {}).some(Boolean) ? 'BGM/SE ACTIVE' : 'BGM INERT'}
                    </span>
                    
                    <button
                      onClick={() => {
                        setIsSoundPopupOpen(!isSoundPopupOpen);
                        setIsPhasePopupOpen(false);
                      }}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 shadow-md border bg-[#121214] text-white/40 border-white/10 hover:border-white/20 hover:text-white"
                      style={Object.values(state.isPlaying || {}).some(Boolean) ? {
                        backgroundImage: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}88)`,
                        borderColor: themeColor,
                        boxShadow: `0 0 15px ${themeColor}77`,
                        color: '#ffffff'
                      } : undefined}
                      title="Audio Control Console"
                    >
                      {Object.values(state.isPlaying || {}).some(Boolean) ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 2. GRAND GM STUDY & SCRIPT VIEW (Fills the entire remaining screen) */}
              <div className="flex-1 w-full bg-black/30 backdrop-blur-md relative overflow-hidden">
                {previewPhase && (
                  <ScriptViewer 
                    phase={previewPhase} 
                    scenario={state.currentScenario}
                    scenarioTitle={state.currentScenario.title}
                    characters={state.currentScenario.characters || EMPTY_CHARACTERS}
                    onUpdateCharacter={handleUpdateCharacter}
                    onToggleChecklist={handleToggleChecklist}
                    isPreviewing={state.previewPhaseId !== state.currentPhaseId}
                    activeTab={activeScriptTab}
                    onTabChange={setActiveScriptTab}
                    onOpenHandout={handleOpenHandout}
                    activeImageId={state.activeImageId}
                    onShowImage={handleShowImage}
                    pdfPageStates={state.pdfPageStates || EMPTY_PDF_PAGE_STATES}
                    onSetPdfPageState={handleSetPdfPageState}
                    onOpenSync={handleOpenSync}
                    onUpdateScenario={handleUpdateScenario}
                  />
                )}
              </div>

              {/* Bottom Navigation: Render progress management bar at bottom ONLY inside mobile mode */}
              {layoutMode === '1-column' && (
                <div className="w-full h-16 bg-[#0a0a0b]/95 backdrop-blur-md border-t border-white/20 flex items-center justify-between px-3 md:px-5 shrink-0 z-50 select-none">
                  {/* Left Area: Horizontal scrollable Phase Card Track */}
                  <div 
                    ref={scrollRef}
                    className="flex items-center gap-1.5 md:gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 max-w-[70%] py-1 cursor-grab active:cursor-grabbing mr-4"
                  >
                    {(state.currentScenario.phases || []).map((phase, index) => {
                      const isActive = phase.id === state.currentPhaseId;
                      const isPreview = phase.id === state.previewPhaseId;
                      
                      const timerId = phase.timers?.[0]?.id || '';
                      const tState = state.timerStates[timerId];

                      const totalSecs = phase.timeMinutes ? (phase.timeMinutes * 60) : (phase.timers?.[0]?.durationMinutes ? phase.timers[0].durationMinutes * 60 : 300);
                      const runningSeconds = tState?.seconds ?? totalSecs;

                      return (
                        <PhaseCard
                          key={phase.id}
                          phase={phase}
                          index={index}
                          isActive={isActive}
                          isPreview={isPreview}
                          unlocked={true}
                          themeColor={themeColor}
                          runningSeconds={runningSeconds}
                          timerState={tState}
                          onPreview={handlePhasePreview}
                          onActivate={handlePhaseTransition}
                          onToggleTimer={onToggleTimer}
                          onSetCompleted={handleSetCompleted}
                          onOpenDetails={() => {
                            setIsPhasePopupOpen(true);
                            setIsSoundPopupOpen(false);
                          }}
                          onResetTimer={onResetTimer}
                        />
                      );
                    })}
                  </div>

                  {/* Center Area: Elegant Draggable Cockpit Clock & Timer (Timer Digits Only) */}
                  <div 
                    ref={timerDropdownRef2}
                    onClick={() => {
                      setIsTimerDropdownOpen(!isTimerDropdownOpen);
                      audioService.activateAudio(state.currentScenario.title);
                    }}
                    className={`relative flex items-center justify-center bg-zinc-950/80 border rounded-full px-5 py-2 hover:border-white/20 select-none shadow-xl cursor-pointer transition-all active:scale-95 shrink-0
                      ${activeTimerState?.isRunning ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]' : 'border-white/10'}`}
                  >
                      <CompactTimerReadout timerState={activeTimerState} className="text-[17px] md:text-[18px] font-mono leading-none font-black tabular-nums tracking-wide transition-all duration-300" />
                      {renderTimerDropdown()}
                  </div>

                  {/* Right Area: Dynamic Audio Monitor Token Mixer Toggle */}
                  <div className="flex items-center gap-3">
                    <span className="hidden md:inline text-[9px] font-black font-cinzel text-white/30 tracking-widest uppercase text-right">
                      {Object.values(state.isPlaying || {}).some(Boolean) ? 'BGM/SE ACTIVE' : 'BGM INERT'}
                    </span>
                    
                    <button
                      onClick={() => {
                        setIsSoundPopupOpen(!isSoundPopupOpen);
                        setIsPhasePopupOpen(false);
                      }}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-95 shadow-md border bg-[#121214] text-white/40 border-white/10 hover:border-white/20 hover:text-white"
                      style={Object.values(state.isPlaying || {}).some(Boolean) ? {
                        backgroundImage: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}88)`,
                        borderColor: themeColor,
                        boxShadow: `0 0 15px ${themeColor}77`,
                        color: '#ffffff'
                      } : undefined}
                      title="Audio Control Console"
                    >
                      {Object.values(state.isPlaying || {}).some(Boolean) ? (
                        <Pause size={18} fill="currentColor" />
                      ) : (
                        <Play size={18} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* AUTO-DISMISS CLICK COVER (Dismisses popups when screen script area is touched) */}
              {(isPhasePopupOpen || isSoundPopupOpen) && (
                <div 
                  className="absolute inset-0 z-[440] bg-black/50 cursor-pointer backdrop-blur-[2px]"
                  onClick={() => {
                    setIsPhasePopupOpen(false);
                    setIsSoundPopupOpen(false);
                  }}
                />
              )}

              {/* 3. CYBER PHASE CONTROLLER MODAL DIALOG (Left hanging popup) */}
              {isPhasePopupOpen && (
                <div className={`absolute left-4 z-[450] w-96 max-h-[82vh] bg-black/95 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200 ${
                  layoutMode === '1-column' 
                    ? 'bottom-[76px] slide-in-from-bottom-3' 
                    : 'top-[76px] slide-in-from-top-3'
                }`} style={{ borderColor: `${themeColor}66` }}>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                    <span className="text-[10px] font-black font-cinzel text-sky-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                      PHASE MATRIX CONTROLLER
                    </span>
                    <button 
                      onClick={() => setIsPhasePopupOpen(false)} 
                      className="text-white/40 hover:text-white text-[10px] font-mono hover:bg-white/5 p-1 px-2.5 rounded-lg border border-white/10 transition-all cursor-pointer"
                    >
                      CLOSE
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-1 select-none">
                    <PhaseSidebar 
                      scenario={state.currentScenario}
                      activePhaseId={state.currentPhaseId}
                      previewPhaseId={state.previewPhaseId}
                      themeColor={themeColor} 
                      onPhasePreview={handlePhasePreview}
                      onPhaseTransition={handlePhaseTransition}
                      onStopPhase={handleStopPhase}
                      onCancelPhase={handleCancelPhase}
                      sessionStartTime={state.sessionStartTime}
                      exitTime={state.exitTime}
                      onExitTimeChange={(time) => setState(s => ({ ...s, exitTime: time }))}
                      isPaused={state.isPaused || false}
                      phaseResults={state.phaseResults}
                      activePhaseStartTime={state.phaseStartTime}
                      onStartSession={handleStartSession}
                      onTogglePause={handleTogglePause}
                      isCollapsed={false}
                    />
                  </div>
                </div>
              )}

              {/* 4. DUAL-STYLE SOUND BOARD & SAMPLER MODAL DIALOG (Right hanging grand gold popup) */}
              {isSoundPopupOpen && (
                <div className={`absolute right-4 z-[450] w-[380px] max-h-[82vh] bg-[#0c0c0e]/98 backdrop-blur-3xl border-2 rounded-2xl p-4 shadow-3xl flex flex-col overflow-hidden animate-in fade-in duration-200 ${
                  layoutMode === '1-column' 
                    ? 'bottom-[76px] slide-in-from-bottom-3' 
                    : 'top-[76px] slide-in-from-top-3'
                }`} style={{ borderColor: `${themeColor}44` }}>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
                    <span className="text-[10px] font-black font-cinzel text-amber-400 uppercase tracking-widest flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      SOUND SAMPLER MIXER
                    </span>
                    <button 
                      onClick={() => setIsSoundPopupOpen(false)} 
                      className="text-white/40 hover:text-white text-[10px] font-mono hover:bg-white/5 p-1 px-2.5 rounded-lg border border-white/10 transition-all cursor-pointer animate-pulse"
                    >
                      CLOSE
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
                    {/* Compact Volume Control inside Popup */}
                    <div className="p-3 bg-[#111113]/80 border border-white/5 rounded-xl flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-cinzel text-white/55 uppercase tracking-wider">Master Vol:</span>
                        <span className="text-[10px] font-mono font-black text-cyan-400">{Math.round(state.volume * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01" value={state.volume || 0}
                        onChange={(e) => setState(s => ({ ...s, volume: parseFloat(e.target.value) }))}
                        className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                      />
                    </div>

                    {/* Integrated custom tracks with perfect circles for BGM / SFX control */}
                    {(state.currentScenario.sounds || []).map((sound) => {
                      const active = !!state.isPlaying[sound.id];
                      const isLinked = (previewPhase?.recommendedSounds || []).includes(sound.id);
                      
                      return (
                        <div 
                          key={sound.id}
                          className={`p-3 rounded-xl border flex flex-col gap-2 relative transition-all duration-200 group/item active:scale-[0.99]
                            ${active 
                              ? 'bg-black/95 border-cyan-500/35 ring-1 ring-cyan-500/10' 
                              : isLinked
                                ? 'bg-[#fffdf0]/5 border-amber-500/15 hover:bg-[#fffdf0]/10' 
                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                            }`}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {isLinked && (
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#f59e0b] shrink-0" title="Phase BGM Recommendation" />
                              )}
                              <span className="text-[11.5px] font-bold text-white/95 truncate font-sans group-hover/item:text-white transition-colors">
                                {sound.name}
                              </span>
                            </div>
                            
                            {/* DEMO REQUIRED IMMUTABLE DESIGN: PERFECT CIRCLE VOLUME CONTROLLER BUTTON */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSound(sound);
                              }}
                              className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-lg border-2
                                ${active 
                                  ? 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.65)]' 
                                  : 'bg-zinc-900 hover:bg-zinc-800 border-white/15 text-white/80 hover:text-white'
                                }`}
                              title={active ? '一時停止' : '再生'}
                            >
                              {active ? (
                                <Pause size={16} fill="currentColor" className="text-white" />
                              ) : (
                                <Play size={16} fill="currentColor" className="text-white ml-0.5" />
                              )}
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-[10px] w-full mt-1 border-t border-white/5 pt-2">
                            {/* IN, OUT, LOOP indicators */}
                            <div className="flex gap-1 shrink-0 z-10">
                              {[
                                { label: 'IN', field: 'fadeInEnabled' as const, color: 'text-sky-400' },
                                { label: 'OUT', field: 'fadeOutEnabled' as const, color: 'text-amber-400' },
                                { label: 'LOOP', field: 'loopEnabled' as const, color: 'text-emerald-400' }
                              ].map(indicator => {
                                const isEnabled = !!sound[indicator.field];
                                return (
                                  <span 
                                    key={indicator.label}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUpdateSoundConfig(sound.id, { [indicator.field]: !isEnabled });
                                    }}
                                    className={`text-[8px] font-black px-1.5 py-0.5 rounded border transition-all cursor-pointer select-none
                                      ${isEnabled 
                                        ? `border-white/20 ${indicator.color} bg-white/10 shadow-[0_0_6px_rgba(255,255,255,0.05)]` 
                                        : 'border-white/[0.05] text-white/20 bg-transparent opacity-40 hover:opacity-100 hover:text-white'
                                      }`}
                                  >
                                    {indicator.label}
                                  </span>
                                );
                              })}
                            </div>

                            {/* Vol Sliders per channel */}
                            <div className="flex-1 flex items-center gap-1.5 min-w-0">
                              <Volume2 size={11} className="text-white/40 shrink-0" />
                              <input 
                                type="range" min="0" max="1" step="0.01" value={sound.volume ?? 0.8}
                                onChange={(e) => handleUpdateSoundConfig(sound.id, { volume: parseFloat(e.target.value) })}
                                className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all min-w-0"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* --- ORIGINAL STANDARD CODE --- */
            <div 
              className="flex h-full relative gap-0 flex-nowrap w-full"
            >
            {/* LEFT PANEL */}
            {hasSidebar && (
              <motion.div 
                className="flex h-full relative shrink-0 gap-0 overflow-hidden"
                animate={{ width: sidebarWidthVal }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <PhaseSidebar 
                  scenario={state.currentScenario}
                  activePhaseId={state.currentPhaseId}
                  previewPhaseId={state.previewPhaseId}
                  themeColor={themeColor} 
                  onPhasePreview={handlePhasePreview}
                  onPhaseTransition={handlePhaseTransition}
                  onStopPhase={handleStopPhase}
                  onCancelPhase={handleCancelPhase}
                  sessionStartTime={state.sessionStartTime}
                  exitTime={state.exitTime}
                  onExitTimeChange={(time) => setState(s => ({ ...s, exitTime: time }))}
                  isPaused={state.isPaused || false}
                  phaseResults={state.phaseResults}
                  activePhaseStartTime={state.phaseStartTime}
                  onStartSession={handleStartSession}
                  onTogglePause={handleTogglePause}
                  isCollapsed={isSidebarCollapsed}
                />
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="hidden md:flex absolute top-1/2 left-0 -translate-y-1/2 w-6 h-12 bg-black/80 border border-white/30 rounded-full items-center justify-center z-50 shadow-2xl backdrop-blur-md hover:border-white/60 cursor-pointer"
                >
                  {isSidebarCollapsed ? <ChevronRight size={14} style={{ color: themeColor }} /> : <ChevronLeft size={14} style={{ color: themeColor }} />}
                </motion.button>
              </motion.div>
            )}

            {/* MIDDLE PANEL */}
            <motion.div 
              className="h-full shrink-0 border-r border-white/5 bg-black/30 backdrop-blur-md overflow-hidden gap-0 relative"
              animate={{ width: middlePanelWidth }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {previewPhase && (
                <ScriptViewer 
                  phase={previewPhase} 
                  scenario={state.currentScenario}
                  scenarioTitle={state.currentScenario.title}
                  characters={state.currentScenario.characters || EMPTY_CHARACTERS}
                  onUpdateCharacter={handleUpdateCharacter}
                  onToggleChecklist={handleToggleChecklist}
                  isPreviewing={state.previewPhaseId !== state.currentPhaseId}
                  activeTab={activeScriptTab}
                  onTabChange={setActiveScriptTab}
                  onOpenHandout={handleOpenHandout}
                  activeImageId={state.gmActiveImageId !== null ? state.gmActiveImageId : state.activeImageId}
                  onShowImage={handleShowImage}
                  pdfPageStates={state.pdfPageStates || EMPTY_PDF_PAGE_STATES}
                  onSetPdfPageState={handleSetPdfPageState}
                  onOpenSync={handleOpenSync}
                  onUpdateScenario={handleUpdateScenario}
                />
              )}
            </motion.div>

            {/* RIGHT PANEL */}
            <motion.section 
              className="h-full shrink-0 flex flex-col gap-0 relative overflow-hidden"
              animate={{ width: soundboardWidthVal }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsSoundboardCollapsed(!isSoundboardCollapsed)}
                className="hidden md:flex absolute top-1/2 left-0 -translate-x-3 -translate-y-1/2 w-6 h-12 bg-black/80 border border-white/30 rounded-full items-center justify-center z-50 shadow-2xl backdrop-blur-md hover:border-white/60 group cursor-pointer"
              >
                {isSoundboardCollapsed ? <ChevronLeft size={14} style={{ color: themeColor }} /> : <ChevronRight size={14} style={{ color: themeColor }} />}
              </motion.button>

              <div 
                id="timer-dock-area"
                className={`hidden md:block shrink-0 transition-all duration-300 relative select-none bg-black/20`}
                style={{ 
                  height: (activeTimer && !isSoundboardCollapsed && (!state.currentScenario.timerDisplayPosition || state.currentScenario.timerDisplayPosition === 'tab' || state.currentScenario.timerDisplayPosition === 'both'))
                    ? (timerDocked ? '280px' : '110px') 
                    : '0px',
                  opacity: (activeTimer && !isSoundboardCollapsed && (!state.currentScenario.timerDisplayPosition || state.currentScenario.timerDisplayPosition === 'tab' || state.currentScenario.timerDisplayPosition === 'both'))
                    ? 1
                    : 0,
                  overflow: 'hidden'
                }}
              >
                {timerDocked && activeTimer && activeTimerState ? (
                  <div className="absolute inset-x-0 top-0 bottom-0 px-4 pt-3 pb-3 flex flex-col gap-2">
                    <motion.div
                       drag
                       dragMomentum={false}
                       dragElastic={0}
                       onDragStart={handleDockedDragStart}
                       className="w-full shrink-0 h-[162px] cursor-grab active:cursor-grabbing touch-none relative z-50"
                    >
                      <TimerCard 
                        config={activeTimer}
                        timerLabelText={state.syncConfig?.timerLabelText}
                        seconds={activeTimerState.seconds}
                        isRunning={activeTimerState.isRunning}
                        startTime={activeTimerState.startTime}
                        themeColor={themeColor}
                        totalTimers={(currentPhase?.timers || []).length}
                        activeTimerIndex={activeTimerIndex}
                        isCollapsed={false}
                        isLoggedIn={!!user}
                        onShare={getShareTimerUrl}
                        onToggle={onToggleTimer}
                        onReset={onResetTimer}
                        onAdjust={onAdjustTimer}
                        isDocked={true}
                        timerFlashOnPauseEnabled={state.currentScenario.timerFlashOnPauseEnabled}
                        imageUrl={state.gmActiveImageId ? (state.currentScenario.playerImages?.find(img => img.id === state.gmActiveImageId)?.url || state.currentScenario.images?.find(img => img.id === state.gmActiveImageId)?.url || null) : state.activeImageId ? (state.currentScenario.playerImages?.find(img => img.id === state.activeImageId)?.url || state.currentScenario.images?.find(img => img.id === state.activeImageId)?.url || null) : null}
                        resourceType={state.gmActiveImageId ? ((state.currentScenario.playerImages?.find(img => img.id === state.gmActiveImageId)?.type || state.currentScenario.images?.find(img => img.id === state.gmActiveImageId)?.type) === 'pdf' ? 'pdf' : 'image') : state.activeImageId ? ((state.currentScenario.playerImages?.find(img => img.id === state.activeImageId)?.type || state.currentScenario.images?.find(img => img.id === state.activeImageId)?.type) === 'pdf' ? 'pdf' : 'image') : null}
                        pdfPage={state.gmActiveImageId ? (() => {
                          const res = state.currentScenario.playerImages?.find(img => img.id === state.gmActiveImageId) || state.currentScenario.images?.find(img => img.id === state.gmActiveImageId);
                          const pdfStates = state.pdfPageStates || {};
                          if (res?.type === 'pdf') return pdfStates[res.url] || 1;
                          return null;
                        })() : state.activeImageId ? (() => {
                          const res = state.currentScenario.playerImages?.find(img => img.id === state.activeImageId) || state.currentScenario.images?.find(img => img.id === state.activeImageId);
                          const pdfStates = state.pdfPageStates || {};
                          if (res?.type === 'pdf') return pdfStates[res.url] || 1;
                          return null;
                        })() : null}
                        onOpenSyncModal={() => setShowSyncModal(true)}
                        onSetDocked={setTimerDocked}
                        onPrev={() => {
                          const timerCount = (currentPhase?.timers || []).length;
                          if (timerCount > 1) {
                            setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
                          }
                        }}
                        onNext={() => {
                          const timerCount = (currentPhase?.timers || []).length;
                          if (timerCount > 1) {
                            setActiveTimerIndex(prev => (prev + 1) % timerCount);
                          }
                        }}
                      />
                    </motion.div>

                    {/* Broadcast status controller */}
                    <div className="shrink-0 bg-black/60 border border-white/5 rounded-xl p-2 flex items-center justify-between gap-3 text-xs w-full animate-in fade-in duration-300">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${state.activeImageId ? 'bg-sky-500 animate-pulse' : 'bg-white/10'}`} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[7px] font-black font-cinzel text-white/30 tracking-wider">PL SYNC DISPLAY</span>
                          <span className="text-[10px] font-mono leading-tight text-white/70 font-extrabold truncate">
                            {state.activeImageId 
                              ? (state.currentScenario.playerImages?.find(img => img.id === state.activeImageId)?.name || state.currentScenario.images?.find(img => img.id === state.activeImageId)?.name || 'ACTIVE IMAGE')
                              : 'MUTED / BLACK SCREEN'
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {state.gmActiveImageId && state.gmActiveImageId !== state.activeImageId && (
                          <button
                            onClick={() => handleSyncImageToPlayers(state.gmActiveImageId)}
                            className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 active:scale-95 text-white text-[8px] font-black font-cinzel tracking-widest flex items-center gap-1 transition-all shadow-md shadow-sky-950/50 cursor-pointer"
                            title="現在のGMプレビュー画像をプレイヤー画面に同期"
                          >
                            SYNC TO PL
                          </button>
                        )}
                        {state.activeImageId && (
                          <button
                            onClick={() => handleSyncImageToPlayers(null)}
                            className="px-1.5 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-rose-950/20 hover:border-rose-500/35 active:scale-95 text-white/40 hover:text-rose-400 text-[8px] font-black font-cinzel tracking-widest transition-all cursor-pointer"
                            title="プレイヤー画面の表示をクリア (非表示)"
                          >
                            MUTE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  (!timerDocked || isNearDock) && (
                    <div className="absolute inset-x-0 top-0 bottom-0 p-3 flex items-center justify-center h-full">
                      {isNearDock ? (
                        <div 
                          className="w-full h-full border-2 border-dashed rounded-xl bg-white/5 flex flex-col items-center justify-center gap-1.5 transition-all duration-300 text-white/50"
                          style={{ borderColor: themeColor }}
                        >
                          <Layout size={12} className="animate-bounce" style={{ color: themeColor }} />
                          <span className="text-[8px] font-bold font-sans tracking-wider uppercase animate-pulse" style={{ color: themeColor }}>
                            指を離してタイマーを戻す
                          </span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setTimerDocked(true)}
                          className={`w-full h-full flex flex-col items-center justify-center gap-1.5 rounded-2xl p-2 cursor-pointer transition-all duration-500 group/dock-area relative overflow-hidden ${
                            isTimerOutOfWindow 
                              ? 'bg-amber-500/10 border-2 border-dashed animate-pulse' 
                              : 'bg-white/[0.02] hover:bg-white/[0.05] border border-dashed border-white/5 hover:border-white/15'
                          }`}
                          style={{
                            borderColor: isTimerOutOfWindow ? themeColor : undefined,
                            boxShadow: isTimerOutOfWindow ? `0 0 25px ${themeColor}40, inset 0 0 15px ${themeColor}20` : undefined
                          }}
                          title="クリックしてタイマーをドックへ戻す"
                        >
                          {isTimerOutOfWindow && (
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/25 via-transparent to-zinc-950/25 pointer-events-none" />
                          )}
                          {/* 跡地用の固定コントロールツールバー */}
                          <div 
                            className="flex items-center gap-1 p-0.5 bg-[#121212] border border-white/10 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-3xl whitespace-nowrap z-10 scale-90 hover:border-white/20 transition-all"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {user && (
                              <>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setShowSyncModal(true); }} 
                                  className="flex flex-col items-center justify-center w-9 h-9 text-sky-500 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-all" 
                                  title="Sync Settings"
                                >
                                  <Settings size={12} />
                                  <span className="text-[6px] font-bold font-cinzel mt-0.5">SYNC</span>
                                </button>
                                <div className="w-px h-5 bg-white/10" />
                              </>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); onAdjustTimer(-60); }} 
                              className="flex flex-col items-center justify-center w-9 h-9 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                              title="-1min"
                            >
                              <Minus size={12} />
                              <span className="text-[6px] font-bold mt-0.5">1 m</span>
                            </button>
                            <div className="w-px h-5 bg-white/10" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); onResetTimer(); }} 
                              className="flex flex-col items-center justify-center w-9 h-9 text-white/20 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all" 
                              title="Reset"
                            >
                              <RotateCcw size={12} />
                              <span className="text-[6px] font-bold font-cinzel mt-0.5">RESET</span>
                            </button>
                            <div className="w-px h-5 bg-white/10" />
                            <button 
                              onClick={(e) => { e.stopPropagation(); onAdjustTimer(60); }} 
                              className="flex flex-col items-center justify-center w-9 h-9 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all" 
                              title="+1min"
                            >
                              <Plus size={12} />
                              <span className="text-[6px] font-bold mt-0.5">1 m</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-1 mt-0.5 z-10">
                            {isTimerOutOfWindow ? (
                              <span 
                                className="text-[8px] font-black font-sans tracking-widest transition-all uppercase leading-none animate-pulse flex items-center gap-1"
                                style={{ color: themeColor }}
                              >
                                [ CLICK TO RESTORE TIMER / ここをクリックでタイマーを戻す ]
                              </span>
                            ) : (
                              <span className="text-[7px] font-black font-sans tracking-widest text-white/15 group-hover/dock-area:text-white/40 transition-all uppercase leading-none">
                                [ RETURN TO DOCK / クリックでタイマーを戻す ]
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <SoundBoard 
                  sounds={state.currentScenario.sounds || []} 
                  isPlaying={state.isPlaying || {}} 
                  onToggleSound={handleToggleSound} 
                  onPlaySound={handlePlaySound}
                  onStopSound={handleStopSound}
                  onUpdateSoundConfig={handleUpdateSoundConfig}
                  onReorderSounds={handleReorderSounds}
                  recommendedIds={currentPhase?.recommendedSounds || []}
                  themeColor={themeColor}
                  masterVolume={state.volume}
                  onMasterVolumeChange={handleMasterVolumeChange}
                  showSideVolume={!showTopVolume}
                  isNarrow={state.currentScenario.narrowAudioPanel}
                  volumePosition={state.currentScenario.masterVolumePosition === 'top' ? 'right-center' : state.currentScenario.masterVolumePosition as 'right-center' | 'right-bottom'}
                  images={combinedImages}
                  syncData={syncData}
                  onControlVideo={handleControlVideo}
                  soundClusters={state.currentScenario.soundClusters || []}
                  onUpdateSoundClusters={handleUpdateSoundClusters}
                  currentPhaseId={state.currentPhaseId}
                  phases={state.currentScenario.phases || []}
                />
              </div>
            </motion.section>
          </div>
          )}
            </div>

            {progressNavPosition === 'bottom' && (
              <PhaseProgressNav
                scenario={state.currentScenario}
                activePhaseId={state.currentPhaseId}
                previewPhaseId={state.previewPhaseId}
                themeColor={themeColor}
                onPhasePreview={handlePhasePreview}
                onPhaseTransition={handlePhaseTransition}
                timerStates={state.timerStates}
                onToggleTimer={onToggleTimer}
                onStartSession={handleStartSession}
                onSetCompleted={handleSetCompleted}
                isPaused={state.isPaused || false}
                sessionStartTime={state.sessionStartTime}
                onOpenPhasePopup={() => setIsPhasePopupOpen(true)}
                position="bottom"
                onResetTimer={onResetTimer}
              />
            )}
          </div>
        )}
      </main>

      {showEndConfirmation && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-cinzel font-bold text-white tracking-widest uppercase">END SESSION?</h3>
              <p className="text-sm text-white/40 leading-relaxed font-cinzel">進行記録やタイマーをリセットし、セッションを終了しますか？</p>
            </div>
            <div className="flex flex-col w-full gap-3">
              <div className="flex w-full gap-3">
                <button onClick={() => setShowEndConfirmation(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 font-bold font-cinzel text-xs border border-white/5 transition-all">CANCEL</button>
                <button onClick={handleConfirmEndSession} className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold font-cinzel text-xs border border-white/10 hover:bg-white/20 transition-all">JUST EXIT</button>
              </div>
              <button 
                onClick={() => {
                   setShowEndConfirmation(false);
                   setPerformanceModalOpen(true);
                }}
                disabled={!user}
                className={`w-full py-4 rounded-xl flex items-center justify-center gap-2 font-bold font-cinzel text-xs shadow-lg transition-all ${user ? 'hover:brightness-110 shadow-emerald-900/10' : 'opacity-40 cursor-not-allowed'}`}
                style={{ backgroundColor: user ? themeColor : 'rgba(255,255,255,0.05)' }}
              >
                <History size={16} /> LOG & EXIT
              </button>
              {!user && <p className="text-[9px] text-white/20 uppercase tracking-widest">Login required to log performance</p>}
            </div>
          </div>
        </div>,
        document.body
      )}

      {showRecoveryModal && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-[#1e50a2]/30 p-8 rounded-2xl max-w-md w-full shadow-[0_0_50px_rgba(30,80,162,0.15)] flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-[#1e50a2]/10 border border-[#1e50a2]/30 flex items-center justify-center text-[#1e50a2] animate-pulse">
              <History size={24} />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-cinzel font-bold text-white tracking-widest uppercase">Session Recovery</h3>
              <p className="text-xs text-white/40 font-mono tracking-wide leading-relaxed mt-1">
                [ {backupData ? new Date(backupData.timestamp).toLocaleTimeString() : ''} - Unclean Exit Detected ]
              </p>
              <p className="text-xs text-white/70 font-sans leading-relaxed mt-4">
                前回のセッションが正常に終了されなかった可能性があります。バックアップデータから状態を復元しますか？
              </p>
              <p className="text-[10px] text-[#1e50a2] font-mono tracking-wide uppercase mt-2">
                Restoring will resume your exact logs, active timers, and player layout.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 w-full mt-2">
              <button 
                onClick={handleRecoverSession}
                className="w-full py-3.5 rounded-xl text-white font-bold font-sans text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg hover:brightness-110"
                style={{ backgroundColor: themeColor }}
              >
                <History size={14} /> セッションを復元する (Recover Last Session)
              </button>
              <button 
                onClick={handleDiscardRecovery}
                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 font-medium font-sans text-xs tracking-wider transition-all"
              >
                破棄する (Discard Backup)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showResetConfirmation && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <div className="bg-zinc-950 border border-white/10 p-8 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200">
            {resetStep === 'select' && (
              <>
                <RotateCcw size={36} className="text-amber-500" />
                <div className="text-center">
                  <h3 className="text-xl font-cinzel font-bold text-white tracking-widest uppercase">Reset & Setup</h3>
                  <p className="text-xs text-white/40 font-sans tracking-wide leading-relaxed mt-2">
                    実行したい初期化操作を選択してください。いずれもデータ消去を伴う重要な操作です。
                  </p>
                </div>

                <div className="flex flex-col gap-4 w-full mt-2">
                  {/* Option 1: App Reset */}
                  <button 
                    onClick={() => setResetStep('confirm_app')}
                    className="group flex flex-col items-start text-left p-5 rounded-xl border border-red-500/20 hover:border-red-500/50 bg-red-950/10 hover:bg-red-950/20 transition-all cursor-pointer relative"
                  >
                    <span className="text-[10px] font-mono text-red-400 font-extrabold uppercase tracking-widest mb-1.5">DANGER / APP INITIALIZATION</span>
                    <span className="text-sm font-bold text-white group-hover:text-red-200 font-sans">アプリのリセット (App Reset)</span>
                    <p className="text-[11px] text-white/40 group-hover:text-white/60 leading-relaxed font-sans mt-2">
                      デフォルトのアプリ紹介（操作ガイド）を読み込み、カスタムシナリオやタイマー位置、メモ帳等のすべての設定を完全に消去して初期状態に戻します。
                    </p>
                  </button>

                  {/* Option 2: Scenario Reset */}
                  <button 
                    onClick={() => setResetStep('confirm_scenario')}
                    className="group flex flex-col items-start text-left p-5 rounded-xl border border-amber-500/25 hover:border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 transition-all cursor-pointer relative"
                  >
                    <span className="text-[10px] font-mono text-amber-400 font-extrabold uppercase tracking-widest mb-1.5">WARNING / RESET SCRIPT</span>
                    <span className="text-sm font-bold text-white group-hover:text-amber-200 font-sans">シナリオリセット (Blank)</span>
                    <p className="text-[11px] text-white/40 group-hover:text-white/60 leading-relaxed font-sans mt-2">
                      現在の進行台本を完全に白紙（新規シナリオ）にします。Markdown書式や新しい文字色の指定例のみが表示されるテンプレートが構築されます。
                    </p>
                  </button>
                </div>

                <div className="w-full flex justify-center mt-2 border-t border-white/5 pt-4">
                  <button 
                    onClick={() => {
                      setShowResetConfirmation(false);
                      setResetStep('select');
                    }} 
                    className="px-6 py-2.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-all font-bold font-sans text-xs border border-white/5 tracking-widest"
                  >
                    キャンセル (BACK)
                  </button>
                </div>
              </>
            )}

            {resetStep === 'confirm_app' && (
              <>
                <div className="p-3 bg-red-950/50 rounded-full border border-red-500/30 animate-pulse text-red-500">
                  <AlertTriangle size={36} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-sans font-black text-red-400 tracking-wider">本当にアプリ全体をリセットしますか？</h3>
                  <p className="text-[12px] text-white/60 font-sans leading-relaxed mt-4 max-w-sm">
                    【警告】この操作は取り消せません。データベース内のすべてのカスタムシナリオ、編集中の進行台本、保存されたセッション、タイマーの配置位置、音量設定など全てのユーザー設定データが完全に消去（Pristine化）されます。
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <button 
                    onClick={handleAppReset}
                    className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold font-sans text-xs tracking-wider transition-all shadow-lg hover:shadow-red-900/30 uppercase"
                  >
                    はい、すべてのデータを初期化します
                  </button>
                  <button 
                    onClick={() => setResetStep('select')} 
                    className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-bold font-sans text-xs tracking-wider transition-all"
                  >
                    選び直す (BACK)
                  </button>
                </div>
              </>
            )}

            {resetStep === 'confirm_scenario' && (
              <>
                <div className="p-3 bg-amber-950/50 rounded-full border border-amber-500/30 text-amber-500">
                  <AlertTriangle size={36} />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-sans font-black text-amber-400 tracking-wider">台本を白紙にリセットしますか？</h3>
                  <p className="text-[12px] text-white/60 font-sans leading-relaxed mt-4 max-w-sm">
                    【警告】現在の進行中の台本・編集データは完全に消去され、Markdown書式・文字色の記述例が含まれた新規シナリオ（空のテンプレート）がロードされます。進行状況もリセットされます。
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full mt-2">
                  <button 
                    onClick={handleScenarioReset}
                    className="w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold font-sans text-xs tracking-wider transition-all shadow-lg hover:shadow-amber-900/20"
                  >
                    はい、台本を白紙に戻します
                  </button>
                  <button 
                    onClick={() => setResetStep('select')} 
                    className="w-full py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-bold font-sans text-xs tracking-wider transition-all"
                  >
                    選び直す (BACK)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}



      <FloatingTimerOverlay
        layoutMode={layoutMode}
        activeTimer={activeTimer}
        activeTimerState={activeTimerState}
        isMenuOpen={isMenuOpen}
        timerDocked={timerDocked}
        isSpecialExtendedLayout={isSpecialExtendedLayout}
        timerRef={timerRef}
        dragConstraints={dragConstraints}
        timerX={timerX}
        timerY={timerY}
        dragX={dragX}
        dragY={dragY}
        themeColor={themeColor}
        currentPhase={currentPhase}
        activeTimerIndex={activeTimerIndex}
        user={user}
        timerLabelText={state.syncConfig?.timerLabelText}
        timerFlashOnPauseEnabled={state.currentScenario.timerFlashOnPauseEnabled}
        getShareTimerUrl={getShareTimerUrl}
        onToggleTimer={onToggleTimer}
        onResetTimer={onResetTimer}
        onAdjustTimer={onAdjustTimer}
        setShowSyncModal={setShowSyncModal}
        setTimerDocked={setTimerDocked}
        setActiveTimerIndex={setActiveTimerIndex}
        handleTimerDragStart={handleTimerDragStart}
        handleTimerDrag={handleTimerDrag}
        handleTimerDragEnd={handleTimerDragEnd}
      />

      <AppModals
        showPreferences={showPreferences}
        setShowPreferences={setShowPreferences}
        currentScenario={{
          ...state.currentScenario,
          images: combinedImages
        }}
        onUpdateScenario={handleUpdateScenario}
        user={user}
        performanceModalOpen={performanceModalOpen}
        setPerformanceModalOpen={setPerformanceModalOpen}
        onSavePerformance={handleSavePerformance}
        themeColor={themeColor}
        phaseResults={state.phaseResults}
        lastError={lastError}
        setLastError={setLastError}
        historyModalOpen={historyModalOpen}
        setHistoryModalOpen={setHistoryModalOpen}
        performanceHistory={performanceHistory}
        onRemovePerformance={handleRemovePerformance}
        showLoginConfirmation={showLoginConfirmation}
        setShowLoginConfirmation={setShowLoginConfirmation}
        onConfirmLogin={handleConfirmLogin}
        handoutCharacterId={handoutCharacterId}
        setHandoutCharacterId={setHandoutCharacterId}
        onUpdateCharacter={handleUpdateCharacter}
        showSyncModal={showSyncModal}
        setShowSyncModal={setShowSyncModal}
        onShareSync={getShareTimerUrl}
        onApplySync={(config) => {
          setState(s => ({ ...s, syncConfig: config, activeImageId: config.activeImageId }));
        }}
        syncConfig={state.syncConfig}
        activeTimer={activeTimer}
        activeTimerState={activeTimerState}
        onToggleTimer={onToggleTimer}
        onResetTimer={onResetTimer}
        onResetSync={handleResetSync}
        quotaExceeded={quotaExceeded}
      />

      <PhaseSearchModal 
        isOpen={isPhaseSearchOpen}
        onClose={() => setIsPhaseSearchOpen(false)}
        phases={state.currentScenario.phases || []}
        activePhaseId={state.currentPhaseId}
        previewPhaseId={state.previewPhaseId}
        onPhasePreview={handlePhasePreview}
        onPhaseTransition={handlePhaseTransition}
        themeColor={themeColor}
      />

      <QuickActionsModal
        isOpen={isQuickActionsOpen}
        onClose={() => setIsQuickActionsOpen(false)}
        onStopAllAudio={() => handleStopSound('all')}
        onResetTimer={() => onResetTimer()}
        onToggleEditorMode={toggleEditorMode}
        onOpenPhaseSearch={() => setIsPhaseSearchOpen(true)}
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenPreferences={() => setShowPreferences(true)}
        isEditorMode={state.isEditorMode}
      />

      <SyncTroubleshooter
        isOpen={isSyncTroubleshooterOpen}
        onClose={() => setIsSyncTroubleshooterOpen(false)}
        quotaExceeded={quotaExceeded}
        isDirty={false}
        timerEnabled={state.syncConfig?.timerEnabled ?? true}
        contentEnabled={state.syncConfig?.contentEnabled ?? true}
        activeImageId={state.activeImageId ?? null}
        isGM={true}
      />

      {showSessionSummary && (
        <PostSessionSummaryModal
          scenario={state.currentScenario}
          phaseDurations={state.phaseResults}
          usedSounds={state.usedSounds || new Set()}
          onClose={() => setShowSessionSummary(false)}
          themeColor={themeColor}
        />
      )}

      {/* マイグレーション通知トースト */}
      <AnimatePresence>
        {migrationToast && migrationToast.show && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-20 right-6 z-[9999] max-w-sm w-full bg-zinc-900/95 border border-yellow-500/30 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden pointer-events-auto"
          >
            <div className="p-4 flex gap-3">
              <div className="flex-shrink-0 mt-0.5 text-yellow-500">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-white font-sans uppercase tracking-wider flex items-center gap-1.5">
                  {migrationToast.title}
                  <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 px-1 py-0.5 rounded text-yellow-500 font-mono">v0.86 Auto</span>
                </h4>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-300 font-sans">
                  {migrationToast.description}
                </p>
              </div>
              <button
                onClick={() => setMigrationToast(null)}
                className="flex-shrink-0 text-zinc-500 hover:text-white transition-colors h-5 w-5 flex items-center justify-center rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="h-1 bg-yellow-500/20 w-full relative overflow-hidden">
              <motion.div 
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 6, ease: "linear" }}
                className="h-full bg-yellow-500 absolute left-0 top-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Real-time Network Toast Banner */}
      <NetworkToast onOpenTroubleshooter={() => setIsSyncTroubleshooterOpen(true)} />
    </div>
  );
}

export default App;
