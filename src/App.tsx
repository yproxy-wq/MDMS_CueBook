import { useScenarioChannel, type ScenarioChannelMessage } from './hooks/useScenarioChannel';
import { TimerTapControl } from './components/TimerTapControl';
import { RecommendedBgmDock } from './components/RecommendedBgmDock';
import { SyncQuickControls } from './components/SyncQuickControls';
import { toggleSelectedTimer } from './utils/timerNavigation';
import {
  selectSyncActiveMediaId,
  selectTimer,
  selectTimerTargetPhase,
  selectViewedPhase,
  selectViewedPhaseRecommendedSoundIds,
} from './utils/sessionSelectors';
import { normalizeSyncConfig, setSyncActiveMedia, setSyncTimerVisibility } from './utils/syncConfig';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { INITIAL_SCENARIO, BLANK_SCENARIO } from './constants';
import { audioService } from './services/AudioService';
import { storageService } from './services/StorageService';
import { syncService, TimerSyncData } from './services/SyncService';
import { sessionRecoveryService } from './services/sessionRecoveryService';
import PhaseSidebar from './components/PhaseSidebar';
import PhaseProgressNav from './components/PhaseProgressNav';
import PhaseCard from './components/PhaseCard';
import { collection, addDoc, query, deleteDoc, doc, onSnapshot, orderBy } from 'firebase/firestore';
import { AppState, Character, ImageResource, Performance, Phase, Scenario, ScenarioSnapshot, SoundCluster, SoundConfig, SoundType, SyncConfig } from './types';
import { db, setOnQuotaExceededListener, handleFirestoreError, OperationType, isQuotaExceeded as checkQuotaInitial } from './lib/firebase';
import { auth } from './lib/firebase';
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
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, RotateCcw, History, ShieldAlert, X, Layout, Minus, Plus, Settings, Play, Pause, SlidersHorizontal, Volume2 } from 'lucide-react';
import { NetworkToast } from './components/NetworkToast';
import { selectSyncMedia, transformDropboxUrl } from './utils/mediaHelper';
import { getR2AssetId, getR2AssetIdFromUrl, touchR2AssetReferences } from './services/R2AssetService';
import { createSecureShareId, createTimerSessionId, isSecureShareId } from './utils/syncHelper';
import { getAppWindowMode } from './utils/appRoute';
import { getPdfPageStateKey } from './utils/pdfAssetHelper';

import { useDisplayNow } from './hooks/useDisplayNow';
import { useSessionRecovery } from './hooks/useSessionRecovery';
import { useAudioController } from './hooks/useAudioController';
import { useAudioLibrarySync } from './hooks/useAudioLibrarySync';
import { usePhaseManager } from './hooks/usePhaseManager';
import { useSyncEngine } from './hooks/useSyncEngine';
import { useQuotaCheck } from './hooks/useQuotaCheck';
import { useFloatingTimer } from './hooks/useFloatingTimer';
import { useLocalVideos } from './hooks/useLocalVideos';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { FloatingTimerOverlay } from './components/FloatingTimerOverlay';
import {
  ScenarioRegistryEntry,
  applyScenarioSettings,
  createScenarioBinding,
  fingerprintScenario,
  writeCloudScenario,
} from './services/ScenarioRegistryService';
import { validateAndMigrateScenario } from './utils/scenarioValidator';
import { parseScenarioFile, SCENARIO_FILE_ACCEPT } from './services/ScenarioFileService';
import { errorLogger } from './services/ErrorLogger';
import { useAppWindowRouting } from './hooks/useAppWindowRouting';
import { useAppModalState } from './hooks/useAppModalState';
import { useAppAuthentication } from './hooks/useAppAuthentication';
import { useScenarioRegistry } from './hooks/useScenarioRegistry';
import { createScenarioSessionSnapshot, restoreScenarioSession } from './utils/scenarioSession';
import { resolveScenarioForSelection } from './utils/scenarioSelection';
import { createResetScenarioWithSnapshot } from './utils/scenarioReset';

const EditorView = React.lazy(() => import('./components/EditorView'));
const TimerShareView = React.lazy(() => import('./components/TimerShareView'));
const PlayerHandoutLoader = React.lazy(() => import('./components/PlayerHandoutLoader'));

const RouteLoadingScreen: React.FC<{ label: string }> = ({ label }) => (
  <div className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-[#050505] text-white">
    <Loader2 className="animate-spin text-white/30 mb-4" size={40} />
    <p className="font-cinzel tracking-[0.3em] text-white/40">{label}</p>
  </div>
);

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
  const {
    isQuickActionsOpen, setIsQuickActionsOpen,
    isMenuOpen, setIsMenuOpen,
    showEndConfirmation, setShowEndConfirmation,
    showResetConfirmation, setShowResetConfirmation,
    resetStep, setResetStep,
    showPreferences, setShowPreferences,
    showLoginConfirmation, setShowLoginConfirmation,
    performanceModalOpen, setPerformanceModalOpen,
    showSessionSummary, setShowSessionSummary,
    historyModalOpen, setHistoryModalOpen,
    handoutCharacterId, setHandoutCharacterId,
    performanceHistory, setPerformanceHistory,
    showSyncModal, setShowSyncModal,
    isPhaseSearchOpen, setIsPhaseSearchOpen,
    isPhasePopupOpen, setIsPhasePopupOpen,
    isSoundPopupOpen, setIsSoundPopupOpen,
  } = useAppModalState();
  const [isReady, setIsReady] = useState(false);
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
  const currentScenarioRef = useRef(state.currentScenario);
  currentScenarioRef.current = state.currentScenario;
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const { user, handleLogin, handleConfirmLogin, handleLogout } = useAppAuthentication(
    state.currentScenario.syncShareId, setShowLoginConfirmation,
  );

  const [activeTimerIndex, setActiveTimerIndex] = useState(0);
  const { requestedScenarioId, setEditorMode } = useAppWindowRouting(setState);

  const toggleEditorMode = useCallback(() => {
    setEditorMode(!state.isEditorMode);
  }, [setEditorMode, state.isEditorMode]);

  const timerTargetPhase = useMemo(() =>
    selectTimerTargetPhase(state.currentScenario, state.currentPhaseId),
    [state.currentScenario, state.currentPhaseId]
  );
  
  const activeTimer = useMemo(() =>
    selectTimer(timerTargetPhase, activeTimerIndex),
    [timerTargetPhase, activeTimerIndex]
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
    const phases = state.currentScenario.phases || [];
    const requested = phaseOrTimerId || activeTimer?.id;
    const timerId = phases.find(phase => phase.id === requested)?.timers?.[0]?.id || requested;
    if (!timerId) return;
    const owner = phases.find(phase => phase.timers?.some(timer => timer.id === timerId));
    if (!owner) return;
    audioService.activateAudio(state.currentScenario.title);
    setActiveTimerIndex(owner.timers.findIndex(timer => timer.id === timerId));
    setState(previous => toggleSelectedTimer(previous, timerId, Date.now()));
  }, [activeTimer?.id, state.currentScenario.phases, state.currentScenario.title, setState]);

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

    const owner = phases.find(phase => phase.timers?.some(timer => timer.id === tid));
    if (owner) setActiveTimerIndex(owner.timers.findIndex(timer => timer.id === tid));

    setState(prev => ({ 
      ...prev, 
      currentPhaseId: owner?.id || prev.currentPhaseId,
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSoundboardCollapsed, setIsSoundboardCollapsed] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [lastError, setLastError] = useState<{code: string; message: string} | null>(null);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(() => checkQuotaInitial());
  const [scenarioSwitching, setScenarioSwitching] = useState(false);
  const [pendingScenarioSwitch, setPendingScenarioSwitch] = useState<ScenarioRegistryEntry | null>(null);
  const initialScenarioResolutionRef = useRef(false);
  const scenarioShortcutHandlerRef = useRef<(slot: number) => void>(() => undefined);
  const scenarioTabIdRef = useRef<string>(`${Date.now()}-${Math.random()}`);
  const scenarioChannelRef = useRef<BroadcastChannel | null>(null);
  const remoteScenarioSwitchRef = useRef(false);
  const pendingRemoteScenarioIdRef = useRef<string | null>(null);

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
    if (windowSize.width < 1200 || windowSize.height < 700) return '2-column';
    return '3-column';
  }, [state.currentScenario.layoutPreset, state.currentScenario.columnLayoutMode, windowSize.width, windowSize.height]);

  const isSpecialExtendedLayout = false;

  const progressNavPosition = useMemo(() => {
    if (state.currentScenario.progressNavPosition) return state.currentScenario.progressNavPosition;
    if (layoutMode === '3-column') return 'sidebar';
    return 'disabled';
  }, [layoutMode, state.currentScenario.progressNavPosition]);

  const isTabletVertical = false;
  const isTabletVerticalCompact = !state.isEditorMode
    && layoutMode === '2-column'
    && windowSize.height > windowSize.width;
  // Native scrolling avoids double movement from touch and scripted scrolling.
  const scrollRef = useRef<HTMLDivElement>(null);

  const showTopVolume = useMemo(() =>
    state.isEditorMode || layoutMode === '1-column' || isTabletVertical ||
    state.currentScenario.masterVolumePosition === 'top' || !state.currentScenario.masterVolumePosition
  , [state.isEditorMode, state.currentScenario.masterVolumePosition, layoutMode, isTabletVertical]);


  // Local videos hook
  const { combinedImages: fallbackMedia } = useLocalVideos(state.currentScenario.images || []);
  const combinedImages = useMemo(
    () => selectSyncMedia(state.currentScenario.playerImages, fallbackMedia),
    [state.currentScenario.playerImages, fallbackMedia]
  );
  const r2ReferencedAssetIds = useMemo(() => [
    ...[...(state.currentScenario.images || []), ...(state.currentScenario.playerImages || [])].map(getR2AssetId),
    ...(state.currentScenario.sounds || []).map(sound => getR2AssetIdFromUrl(sound.url)),
  ].filter((assetId): assetId is string => assetId !== null), [
    state.currentScenario.images,
    state.currentScenario.playerImages,
    state.currentScenario.sounds,
  ]);
  const r2ReferenceKey = [...new Set(r2ReferencedAssetIds)].sort().join(',');

  useEffect(() => {
    if (!user || !r2ReferenceKey) return;
    void touchR2AssetReferences(r2ReferenceKey.split(',')).catch((error) => {
      // A stale imported asset may belong to another owner. It remains hidden
      // from this account rather than interrupting the current GM workflow.
      console.warn('[R2 asset] Failed to refresh scenario references:', error);
    });
  }, [user, r2ReferenceKey]);

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
  }, [user, isQuotaExceeded, setPerformanceHistory]);

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

  const { handleStopSound, handleStopAllSounds, handlePlaySound, handleToggleSound } = useAudioController(state, setState, activateAudioWithPrefs, message => {
    setMigrationToast({ show: true, title: '音声を再生できませんでした', description: message, type: 'warning' });
  });

  const viewedPhase = useMemo(() =>
    selectViewedPhase(state.currentScenario, state.previewPhaseId),
    [state.currentScenario, state.previewPhaseId]
  );
  const viewedPhaseRecommendedSoundIds = useMemo(
    () => selectViewedPhaseRecommendedSoundIds(viewedPhase),
    [viewedPhase],
  );
  const syncActiveMediaId = useMemo(() => selectSyncActiveMediaId(state.syncConfig, state.activeImageId), [
    state.activeImageId,
    state.syncConfig,
  ]);

  const { syncData } = useSyncEngine({
    user,
    state,
    setState,
    isReady,
    setIsReady,
    activeTimerIndex,
    timerTargetPhase,
    scenarioId: requestedScenarioId,
  });

  const { scenarioEntries, refreshScenarioRegistry } = useScenarioRegistry({
    isReady, user, currentScenarioRef, setState,
  });

  const audioLibraryStatus = useAudioLibrarySync(user, isReady, state, setState, message => {
    setMigrationToast({ show: true, title: '音源一覧の同期を確認してください', description: message, type: 'warning' });
  }, handleStopSound);

  useEffect(() => {
    if (!isReady || !user) return;
    const registered = scenarioEntries.some(entry => entry.scenarioId === state.currentScenario.id && (entry.source === 'cloud' || entry.source === 'both'));
    if (!registered) return;
    const timer = window.setTimeout(() => {
      writeCloudScenario(user, state.currentScenario).catch(error => {
        console.warn('Scenario settings sync failed; local copy is retained.', error);
        errorLogger.logOperationError(error, {
          code: 'SCENARIO_SETTINGS_SYNC_FAILED', operation: 'scenario.settings.sync', recoverable: true,
          scenarioId: state.currentScenario.id,
        });
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [isReady, scenarioEntries, state.currentScenario, user]);

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

    const currentTimer = selectTimer(timerTargetPhase, activeTimerIndex);
    const timerState = currentTimer ? state.timerStates[currentTimer.id] : null;

    const r2AssetId = action === 'stop' ? null : getR2AssetId(mediaItem);
    const resolvedUrl = r2AssetId ? null : (mediaItem?.url 
      ? transformDropboxUrl(mediaItem.url) 
      : (videoId && videoId.startsWith('http') ? transformDropboxUrl(videoId) : null));

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
      r2AssetId,
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

    syncService.setTimerInstant(sessionId, mergedData).catch((error) => {
      console.warn('[Sync] Immediate media control write failed:', error);
    });
  }, [user, state, timerTargetPhase, activeTimerIndex, syncData, combinedImages]);

  useEffect(() => {
    setActiveTimerIndex(0);
  }, [state.currentScenario.id]);

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

  const handleAddDropboxPdfAsset = useCallback((asset: ImageResource) => {
    setState((previous) => {
      const baseMedia = previous.currentScenario.playerImages && previous.currentScenario.playerImages.length > 0
        ? previous.currentScenario.playerImages
        : (previous.currentScenario.images || []);
      const playerImages = [...baseMedia.filter((media) => media.id !== asset.id), asset];
      return {
        ...previous,
        currentScenario: { ...previous.currentScenario, playerImages },
        activeImageId: asset.id,
        syncConfig: setSyncActiveMedia(previous.syncConfig, asset.id, asset),
        pdfPageStates: { ...(previous.pdfPageStates || {}), [getPdfPageStateKey(asset)]: 1 },
      };
    });
  }, []);

  const { 
    handlePhasePreview, 
    handlePhaseTransition, 
    handleStopPhase,
    handleCancelPhase 
  } = usePhaseManager(setState);

  const handleSetCompleted = useCallback(() => {}, []);

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
    return (state.currentScenario.phases || []).findIndex(p => p.id === state.previewPhaseId);
  }, [state.currentScenario.phases, state.previewPhaseId]);

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
  const activePdfMedia = syncActiveMediaId
    ? combinedImages.find((item) => item.id === syncActiveMediaId || item.url === syncActiveMediaId)
    : undefined;
  useGlobalShortcuts({
    scenario: state.currentScenario,
    keyboardShortcuts: state.currentScenario.keyboardShortcuts,
    sounds: state.currentScenario.sounds,
    combinedImages,
    activeImageId: syncActiveMediaId,
    activePdfUrl: activePdfMedia?.type === 'pdf' ? activePdfMedia.url : null,
    activePdfPage: activePdfMedia?.type === 'pdf' ? (state.pdfPageStates?.[getPdfPageStateKey(activePdfMedia)] || 1) : undefined,
    onSetPdfPage: activePdfMedia?.type === 'pdf'
      ? (page) => handleSetPdfPageState(getPdfPageStateKey(activePdfMedia), page)
      : undefined,
    isEditorMode: state.isEditorMode,
    onSetEditorMode: setEditorMode,
    onToggleEditorMode: toggleEditorMode,
    onToggleTimer: () => onToggleTimer(),
    onResetTimer: () => onResetTimer(),
    onToggleSound: handleToggleSound,
    onPlaySound: handlePlaySound,
    onStopAllSounds: handleStopAllSounds,
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
    onSwitchScenarioSlot: slot => scenarioShortcutHandlerRef.current(slot),
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

  const handleUpdateRecommendedSounds = useCallback((phaseId: string, recommendedSounds: string[]) => {
    const phases = state.currentScenario.phases || [];
    if (!phases.some((phase) => phase.id === phaseId)) return;
    handleUpdateScenario({
      phases: phases.map((phase) => phase.id === phaseId ? { ...phase, recommendedSounds } : phase),
    });
  }, [state.currentScenario.phases, handleUpdateScenario]);

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
  }, [state.currentScenario.syncShareId, setShowEndConfirmation]);

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
    const targetInitialScenario = createResetScenarioWithSnapshot(
      state.currentScenario, INITIAL_SCENARIO, '[自動: アプリ初期化前]',
    );

    // 1. Clear IndexedDB
    try {
      await storageService.saveScenario('gm_accomplice_scenario', targetInitialScenario);
    } catch (e) {
      console.error("IndexedDB reset failed:", e);
      errorLogger.logOperationError(e, {
        code: 'APP_RESET_STORAGE_FAILED', operation: 'app.reset.storage', recoverable: true,
        scenarioId: state.currentScenario.id,
      });
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
      errorLogger.logOperationError(e, {
        code: 'APP_RESET_PREFERENCES_FAILED', operation: 'app.reset.preferences', recoverable: true,
        scenarioId: state.currentScenario.id,
      });
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
  }, [state.currentScenario, setResetStep, setShowResetConfirmation]);

  const handleScenarioReset = useCallback(async () => {
    const targetBlankScenario = createResetScenarioWithSnapshot(
      state.currentScenario, BLANK_SCENARIO, '[自動: リセット直前]',
    );

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
  }, [state.currentScenario, setResetStep, setShowResetConfirmation]);

  // Existing handout URLs may still update their own character record. GM画面には操作導線を置かない。
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
      const media = selectSyncMedia(s.currentScenario.playerImages, s.currentScenario.images || [])
        .find((item) => item.id === targetId);
      const syncConfig = setSyncActiveMedia(s.syncConfig, targetId, media);
      return { 
        ...s, 
        activeImageId: targetId,
        syncConfig
      };
    });
  }, []);

  const handleApplySyncConfig = useCallback((config: SyncConfig | undefined) => {
    const syncConfig = normalizeSyncConfig(config);
    setState((previous) => ({
      ...previous,
      syncConfig,
      activeImageId: syncConfig.activeImageId,
    }));
  }, []);

  const handleSetSyncTimerVisible = useCallback((visible: boolean) => {
    setState((previous) => {
      const syncConfig = setSyncTimerVisibility(previous.syncConfig, visible);
      return { ...previous, syncConfig, activeImageId: syncConfig.activeImageId };
    });
  }, []);

  const handleUpdateSoundClusters = useCallback((clusters: SoundCluster[]) => {
    handleUpdateScenario({
      ...state.currentScenario,
      soundClusters: clusters
    });
  }, [state.currentScenario, handleUpdateScenario]);

  const handleOpenSync = useCallback(() => {
    setShowSyncModal(true);
  }, [setShowSyncModal]);

  const broadcastActiveScenario = useCallback((scenarioId: string) => {
    const payload = { type: 'scenario-active', scenarioId, source: scenarioTabIdRef.current, timestamp: Date.now() };
    scenarioChannelRef.current?.postMessage(payload);
    try {
      localStorage.setItem(`cuebook_active_scenario:${user?.uid || 'anonymous'}`, JSON.stringify(payload));
    } catch {
      // BroadcastChannel remains available when storage is blocked.
    }
  }, [user?.uid]);

  const commitScenarioSwitch = useCallback(async (entry: ScenarioRegistryEntry, scenario: Scenario) => {
    const current = latestStateRef.current;
    // AppState has one active scenario at a time. Progress remains parallel
    // in IndexedDB, so persist the current session before replacing it.
    const currentSession = createScenarioSessionSnapshot(current);
    await storageService.saveSession(current.currentScenario.id, currentSession);
    await storageService.saveScenario(scenario.id, scenario);
    const savedSession = await storageService.loadSession(scenario.id);
    setState(previous => ({
      ...previous,
      currentScenario: scenario,
      ...restoreScenarioSession(scenario, savedSession, previous.syncConfig),
      isPlaying: {},
    }));
    setActiveTimerIndex(0);
    const params = new URLSearchParams(window.location.search);
    params.set('scenarioId', entry.scenarioId);
    window.history.pushState({ ...window.history.state, scenarioId: entry.scenarioId }, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    setPendingScenarioSwitch(null);
    setScenarioSwitching(false);
    setMigrationToast({
      show: true,
      title: 'SCENARIO SWITCHED',
      description: `${entry.title} を開きました。`,
      type: 'success',
    });
    if (!remoteScenarioSwitchRef.current) broadcastActiveScenario(entry.scenarioId);
    await refreshScenarioRegistry();
  }, [broadcastActiveScenario, refreshScenarioRegistry, setState]);

  const restoreScenarioUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('scenarioId', state.currentScenario.id);
    window.history.replaceState({ ...window.history.state, scenarioId: state.currentScenario.id }, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }, [state.currentScenario.id]);

  const bindScenarioFile = useCallback((entry: ScenarioRegistryEntry) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SCENARIO_FILE_ACCEPT;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        restoreScenarioUrl();
        return;
      }
      setScenarioSwitching(true);
      try {
        const imported = await parseScenarioFile(file);
        if (imported.id !== entry.scenarioId) {
          alert(`このファイルは「${entry.title}」と一致しません。\n別のファイルを選択してください。`);
          return;
        }
        const importedFingerprint = await fingerprintScenario(imported);
        const existingBinding = await storageService.loadBinding(entry.scenarioId);
        if (existingBinding && existingBinding.fileFingerprint !== importedFingerprint) {
          const shouldReplace = window.confirm(`「${entry.title}」の更新版を検出しました。\n\n旧ファイルを残し、このファイルを新しい版として登録しますか？`);
          if (!shouldReplace) return;
        } else if (entry.fileFingerprint && entry.fileFingerprint !== importedFingerprint) {
          const keepLocal = window.confirm(`「${entry.title}」の登録版と内容が異なります。\nこのファイルをこの端末のローカル版として登録しますか？`);
          if (!keepLocal) return;
        }
        await createScenarioBinding(imported, file.name, entry.scenarioId);
        const scenarioWithSettings = applyScenarioSettings(imported, entry.settings);
        if (user) await writeCloudScenario(user, scenarioWithSettings, file.name);
        await commitScenarioSwitch(entry, scenarioWithSettings);
      } catch (error) {
        console.error('Scenario binding failed:', error);
        errorLogger.logOperationError(error, {
          code: 'SCENARIO_BIND_FAILED', operation: 'scenario.bind', recoverable: true,
          scenarioId: entry.scenarioId,
        });
        alert('シナリオファイルを読み込めませんでした。形式と内容を確認してください。');
      } finally {
        setScenarioSwitching(false);
      }
    };
    input.click();
  }, [commitScenarioSwitch, restoreScenarioUrl, user]);

  const performScenarioSelect = useCallback(async (entry: ScenarioRegistryEntry) => {
    setScenarioSwitching(true);
    try {
      if (entry.availability === 'mismatch') {
        bindScenarioFile(entry);
        setScenarioSwitching(false);
        return false;
      }
      const storedScenario = await storageService.loadScenario(entry.scenarioId);
      const localScenario = resolveScenarioForSelection(entry.scenarioId, storedScenario);
      if (!localScenario) {
        bindScenarioFile(entry);
        setScenarioSwitching(false);
        return false;
      }
      const nextScenario = applyScenarioSettings(validateAndMigrateScenario(localScenario), entry.settings);
      await commitScenarioSwitch(entry, nextScenario);
      return true;
    } catch (error) {
      console.error('Scenario switch failed:', error);
      errorLogger.logOperationError(error, {
        code: 'SCENARIO_SWITCH_FAILED', operation: 'scenario.switch', recoverable: true,
        scenarioId: entry.scenarioId,
      });
      alert('シナリオを切り替えられませんでした。現在のシナリオは維持されています。');
      setScenarioSwitching(false);
      return false;
    }
  }, [bindScenarioFile, commitScenarioSwitch]);

  const handleScenarioSelect = useCallback(async (entry: ScenarioRegistryEntry) => {
    if (entry.scenarioId === state.currentScenario.id) return false;
    const hasRunningTimer = Object.values(state.timerStates).some(timer => timer.isRunning);
    const hasProgress = hasRunningTimer || Object.keys(state.phaseResults).length > 0 || Boolean(state.phaseStartTime);
    if (hasProgress) {
      setPendingScenarioSwitch(entry);
      return 'confirmation' as const;
    }
    return await performScenarioSelect(entry);
  }, [performScenarioSelect, state.currentScenario.id, state.phaseResults, state.phaseStartTime, state.timerStates]);

  scenarioShortcutHandlerRef.current = (slot: number) => {
    const entry = scenarioEntries[slot];
    if (entry) void handleScenarioSelect(entry);
  };

  const registerLocalScenarios = useCallback(async () => {
    if (!user) {
      setShowLoginConfirmation(true);
      return;
    }
    setScenarioSwitching(true);
    try {
      const keys = await storageService.listScenarioKeys();
      const loadedScenarios = await Promise.all(keys.filter(key => key !== 'gm_accomplice_scenario').map(key => storageService.loadScenario(key)));
      const localScenarios = [...loadedScenarios, state.currentScenario].filter((scenario, index, list): scenario is Scenario => Boolean(scenario) && list.findIndex(item => item?.id === scenario?.id) === index);
      for (const scenario of localScenarios) {
        if (scenario) {
          await createScenarioBinding(scenario, `${scenario.title || scenario.id}.json`, scenario.id);
          await writeCloudScenario(user, scenario, `${scenario.title || scenario.id}.json`);
        }
      }
      await refreshScenarioRegistry();
      setMigrationToast({ show: true, title: 'MY SCENARIOS UPDATED', description: 'この端末のシナリオをアカウントに登録しました。', type: 'success' });
    } catch (error) {
      console.error('Scenario registration failed:', error);
      errorLogger.logOperationError(error, {
        code: 'SCENARIO_REGISTRATION_FAILED', operation: 'scenario.register', recoverable: true,
        scenarioId: state.currentScenario.id,
      });
      alert('マイシナリオへの登録に失敗しました。ローカルデータは保持されています。');
    } finally {
      setScenarioSwitching(false);
    }
  }, [refreshScenarioRegistry, setShowLoginConfirmation, state.currentScenario, user]);

  const confirmPendingScenarioSwitch = useCallback(async () => {
    if (!pendingScenarioSwitch) return;
    const entry = pendingScenarioSwitch;
    setPendingScenarioSwitch(null);
    await performScenarioSelect(entry);
  }, [pendingScenarioSwitch, performScenarioSelect]);

  const handleScenarioChannelMessage = useCallback((message: ScenarioChannelMessage) => {
    if (message.type === 'scenario-active-request') {
      broadcastActiveScenario(state.currentScenario.id);
      return;
    }
    const scenarioId = message.scenarioId;
    if (message.type !== 'scenario-active' || !scenarioId || scenarioId === state.currentScenario.id) return;
    pendingRemoteScenarioIdRef.current = scenarioId;
    const entry = scenarioEntries.find(item => item.scenarioId === scenarioId);
    if (!entry || scenarioSwitching || remoteScenarioSwitchRef.current) return;
    pendingRemoteScenarioIdRef.current = null;
    remoteScenarioSwitchRef.current = true;
    void performScenarioSelect(entry).finally(() => { remoteScenarioSwitchRef.current = false; });
  }, [broadcastActiveScenario, performScenarioSelect, scenarioEntries, scenarioSwitching, state.currentScenario.id]);

  useScenarioChannel({
    enabled: isReady,
    scope: user?.uid || 'anonymous',
    source: scenarioTabIdRef.current,
    channelRef: scenarioChannelRef,
    onMessage: handleScenarioChannelMessage,
  });

  useEffect(() => {
    const handleScenarioHistory = () => {
      const scenarioId = new URLSearchParams(window.location.search).get('scenarioId');
      if (!scenarioId || scenarioId === state.currentScenario.id) return;
      const entry = scenarioEntries.find(item => item.scenarioId === scenarioId);
      if (entry) handleScenarioSelect(entry);
    };
    window.addEventListener('popstate', handleScenarioHistory);
    return () => window.removeEventListener('popstate', handleScenarioHistory);
  }, [handleScenarioSelect, scenarioEntries, state.currentScenario.id]);

  useEffect(() => {
    if (!isReady || !requestedScenarioId || initialScenarioResolutionRef.current) return;
    const entry = scenarioEntries.find(item => item.scenarioId === requestedScenarioId);
    if (!entry) {
      if (scenarioEntries.length > 0) {
        initialScenarioResolutionRef.current = true;
        restoreScenarioUrl();
        setMigrationToast({ show: true, title: 'SCENARIO NOT FOUND', description: '指定されたシナリオはこのアカウントまたは端末で利用できません。', type: 'warning' });
      }
      return;
    }
    if (entry.scenarioId === state.currentScenario.id) {
      if (entry?.scenarioId === state.currentScenario.id) initialScenarioResolutionRef.current = true;
      return;
    }
    initialScenarioResolutionRef.current = true;
    handleScenarioSelect(entry);
  }, [handleScenarioSelect, isReady, requestedScenarioId, restoreScenarioUrl, scenarioEntries, state.currentScenario.id]);

  const handleExportZip = async () => {
    const { default: JSZip } = await import('jszip');
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const baseName = `${state.currentScenario.title}_ScenarioMaster_${dateStr}`;
    const zip = new JSZip();
    zip.file(`${baseName}.json`, JSON.stringify(state.currentScenario, null, 2));
    const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}.zip`;
    a.click();
  };

  const handleImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = SCENARIO_FILE_ACCEPT;
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;
      const fileName = String(file.name || '').toLowerCase();
      try {
        if (fileName.endsWith('.json') || fileName.endsWith('.zip') || fileName.endsWith('.cuebook') || file.type === 'application/zip') {
          const data = await parseScenarioFile(file);
          if (data && data.title && data.phases) handleUpdateScenario(data);
          else alert("Invalid scenario data.");
        }
      } catch (err) { 
        console.error("Import failed:", err);
        errorLogger.logOperationError(err, {
          code: 'SCENARIO_IMPORT_FAILED', operation: 'scenario.import', recoverable: true,
          scenarioId: state.currentScenario.id,
        });
        alert("Import failed. Please check the file format."); 
      }
    };
    input.click();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (e.touches.length !== 1 || target.closest('.script-viewer, .phase-tab-track, button, input, select, textarea, [contenteditable], table, iframe')) {
      touchStartX.current = null;
      touchStartY.current = null;
      return;
    }
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

  const queryParams = new URLSearchParams(window.location.search);
  const view = queryParams.get('view');
  const sessionId = queryParams.get('sessionId');

  if (view === 'timer' && sessionId) {
    return (
      <React.Suspense fallback={<RouteLoadingScreen label="Connecting to Sync Channel..." />}>
        <TimerShareView sessionId={sessionId} themeColor={themeColor} />
      </React.Suspense>
    );
  }

  const handoutCid = queryParams.get('cid');
  const handoutSid = queryParams.get('sid');

  if (handoutCid && handoutSid) {
    return (
      <React.Suspense fallback={<RouteLoadingScreen label="Establishing Secure Channel..." />}>
        <div className="h-[100dvh] w-screen bg-[#050505]">
          <PlayerHandoutLoader
            characterId={handoutCid}
            sessionId={handoutSid}
            themeColor={themeColor}
          />
        </div>
      </React.Suspense>
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

  const liveControlBar = !state.isEditorMode ? (
    <RecommendedBgmDock
      phase={viewedPhase}
      sounds={state.currentScenario.sounds || []}
      isPlaying={state.isPlaying || {}}
      themeColor={themeColor}
      onToggleSound={handleToggleSound}
      onUpdateRecommendedSounds={handleUpdateRecommendedSounds}
    >
      <SyncQuickControls
        embedded
        syncConfig={normalizeSyncConfig(state.syncConfig)}
        onSetTimerVisible={handleSetSyncTimerVisible}
        onOpenSyncStudio={() => setShowSyncModal(true)}
      />
    </RecommendedBgmDock>
  ) : null;

  const topbarBgmControl = !state.isEditorMode ? (
    <RecommendedBgmDock
      placement="topbar"
      phase={viewedPhase}
      sounds={state.currentScenario.sounds || []}
      isPlaying={state.isPlaying || {}}
      themeColor={themeColor}
      onToggleSound={handleToggleSound}
      onUpdateRecommendedSounds={handleUpdateRecommendedSounds}
    />
  ) : null;

  const performanceControlBar = !state.isEditorMode ? (
    <section aria-label="進行操作" className="performance-control-bar shrink-0 border-b border-white/10 bg-[#0a0a0b] px-3 py-1.5 text-white">
      <div className="performance-control-bar__content flex min-h-11 items-center justify-between gap-3">
        <div className="performance-control-bar__primary flex min-w-0 items-center gap-3">
          <div
            className={`performance-control-bar__timer relative flex items-center justify-center rounded-lg border bg-zinc-950/80 px-4 py-2 shadow-xl transition-all hover:border-white/20 shrink-0 select-none
              ${activeTimerState?.isRunning ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]' : 'border-white/10'}`}
            style={{ borderWidth: '0px' }}
          >
            <TimerTapControl key={state.currentScenario.id + ':' + activeTimer?.id} isRunning={Boolean(activeTimerState?.isRunning)} disabled={!activeTimer} onToggle={() => onToggleTimer()}>
              <CompactTimerReadout timerState={activeTimerState} className="font-mono leading-none font-black tabular-nums tracking-wide transition-all duration-300" fontSize="clamp(30px, 4.8vw, 38px)" />
            </TimerTapControl>
            <button type="button" aria-label="タイマー・子画面設定を開く" aria-haspopup="dialog"
              onClick={() => setShowSyncModal(true)}
              className="flex h-[44px] w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg text-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
              <Settings size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {topbarBgmControl}
            <button
              type="button"
              onClick={() => {
                setIsSoundPopupOpen(!isSoundPopupOpen);
                setIsPhasePopupOpen(false);
              }}
              className="order-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#121214] text-white/45 shadow-md transition-all duration-300 hover:border-white/20 hover:text-white active:scale-95"
              style={Object.values(state.isPlaying || {}).some(Boolean) ? {
                backgroundImage: `linear-gradient(135deg, ${themeColor}dd, ${themeColor}88)`,
                borderColor: themeColor,
                boxShadow: `0 0 15px ${themeColor}77`,
                color: '#ffffff'
              } : undefined}
              title="音響パネル"
              aria-label="音響パネルを開く" aria-expanded={isSoundPopupOpen}
            >
              <SlidersHorizontal size={17} />
            </button>
          </div>
        </div>
        <SyncQuickControls
          embedded
          syncConfig={normalizeSyncConfig(state.syncConfig)}
          onSetTimerVisible={handleSetSyncTimerVisible}
          onOpenSyncStudio={() => setShowSyncModal(true)}
          className="performance-control-bar__sync"
        />
      </div>
    </section>
  ) : null;

  return (
    <div 
      className={[
        'h-[100dvh] w-screen flex flex-col bg-[#050505] overflow-hidden select-none relative font-sans text-white/80 transition-all duration-300',
        isTabletVerticalCompact && 'tablet-reading-toolbar--compact',
      ].filter(Boolean).join(' ')}
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

      <div className="tablet-reading-toolbar relative z-50 shrink-0">
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
          const timerCount = (timerTargetPhase?.timers || []).length;
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
          }
        }}
        onNextTimer={() => {
          const timerCount = (timerTargetPhase?.timers || []).length;
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev + 1) % timerCount);
          }
        }}
        onMenuShowChange={setIsMenuOpen}
        totalTimers={(timerTargetPhase?.timers || []).length}
        timerDisplayPosition={state.currentScenario.timerDisplayPosition}
        onOpenSync={() => setShowSyncModal(true)}
        quotaExceeded={quotaExceeded}
        customShortcuts={state.currentScenario.keyboardShortcuts}
        currentScenarioId={state.currentScenario.id}
        scenarioEntries={scenarioEntries}
        onScenarioSelect={handleScenarioSelect}
        onRegisterLocalScenarios={registerLocalScenarios}
        scenarioSwitching={scenarioSwitching}
      />

      {layoutMode !== '2-column' && liveControlBar}

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
      </div>

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
                audioLibraryStatus={audioLibraryStatus}
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
                    recommendedIds={viewedPhaseRecommendedSoundIds}
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
                {viewedPhase && (
                  <ScriptViewer 
                    phase={viewedPhase}
                    scenario={state.currentScenario}
                    scenarioTitle={state.currentScenario.title}
                    isPreviewing={false}
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
                <div className="tablet-reading-phase-nav w-full h-16 bg-[#0a0a0b] border-b border-white/20 flex items-center justify-between px-3 md:px-5 shrink-0 z-50 select-none">
                  {/* Left Area: Horizontal scrollable Phase Card Track */}
                  <div 
                    ref={scrollRef}
                    className="flex items-center gap-1.5 md:gap-2 phase-tab-track overflow-x-auto no-scrollbar flex-1 min-w-0 py-1 cursor-grab active:cursor-grabbing mr-4"
                    style={{ minHeight: '56px', backgroundColor: 'transparent' }}
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

                </div>
              )}

              {layoutMode === '2-column' && performanceControlBar}

              {/* 2. GRAND GM STUDY & SCRIPT VIEW (Fills the entire remaining screen) */}
              <div className="flex-1 w-full bg-black/30 backdrop-blur-md relative overflow-hidden">
                {viewedPhase && (
                  <ScriptViewer 
                    phase={viewedPhase}
                    scenario={state.currentScenario}
                    scenarioTitle={state.currentScenario.title}
                    onToggleChecklist={handleToggleChecklist}
                    isPreviewing={false}
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
                    className="flex items-center gap-1.5 md:gap-2 phase-tab-track overflow-x-auto no-scrollbar flex-1 min-w-0 py-1 cursor-grab active:cursor-grabbing mr-4"
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
                    className={`relative flex items-center justify-center bg-zinc-950/80 border rounded-full px-5 py-2 hover:border-white/20 select-none shadow-xl transition-all shrink-0
                      ${activeTimerState?.isRunning ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.12)]' : 'border-white/10'}`}
                  >
                      <TimerTapControl key={state.currentScenario.id + ':' + activeTimer?.id} isRunning={Boolean(activeTimerState?.isRunning)} disabled={!activeTimer} onToggle={() => onToggleTimer()}>
                        <CompactTimerReadout timerState={activeTimerState} className="text-[17px] md:text-[18px] font-mono leading-none font-black tabular-nums tracking-wide transition-all duration-300" />
                      </TimerTapControl>
                      <button type="button" aria-label="タイマー・子画面設定を開く" aria-haspopup="dialog"
                        onClick={() => setShowSyncModal(true)}
                        className="flex h-[44px] w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-lg text-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
                        <Settings size={16} aria-hidden="true" />
                      </button>
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
                      title="音響パネル" aria-label="音響パネルを開く" aria-expanded={isSoundPopupOpen}
                    >
                      <SlidersHorizontal size={18} aria-hidden="true" />
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
                <div className={`absolute left-4 z-[450] w-96 max-w-[calc(100%-2rem)] max-h-[82vh] bg-black/95 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200 ${
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
                <div className={`absolute right-4 z-[450] w-[380px] max-w-[calc(100%-2rem)] max-h-[82vh] bg-[#0c0c0e]/98 backdrop-blur-3xl border-2 rounded-2xl p-4 shadow-3xl flex flex-col overflow-hidden animate-in fade-in duration-200 ${
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
                        className="flex-1 h-11 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
                      />
                    </div>

                    {/* Integrated custom tracks with perfect circles for BGM / SFX control */}
                    {(state.currentScenario.sounds || []).map((sound) => {
                      const active = !!state.isPlaying[sound.id];
                      const isLinked = viewedPhaseRecommendedSoundIds.includes(sound.id);
                      
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
                                { label: 'フェードイン', field: 'fadeInEnabled' as const, color: 'text-sky-400' },
                                { label: 'フェードアウト', field: 'fadeOutEnabled' as const, color: 'text-amber-400' },
                                { label: 'ループ', field: 'loopEnabled' as const, color: 'text-emerald-400' }
                              ].map(indicator => {
                                const isEnabled = !!sound[indicator.field];
                                return (
                                  <span 
                                    key={indicator.label}
                                    title={`${indicator.label}: ${isEnabled ? '有効' : '無効'}（変更は音源編集から）`}
                                    className={`text-[8px] font-black px-1.5 py-0.5 rounded border transition-all select-none
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
                                type="range" min="0" max="1" step="0.01" value={sound.volume ?? 0.8} aria-label={`${sound.name}の音量`}
                                onChange={(e) => handleUpdateSoundConfig(sound.id, { volume: parseFloat(e.target.value) })}
                                className="flex-1 h-11 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all min-w-0"
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
              {viewedPhase && (
                <ScriptViewer 
                  phase={viewedPhase}
                  scenario={state.currentScenario}
                  scenarioTitle={state.currentScenario.title}
                  onToggleChecklist={handleToggleChecklist}
                  isPreviewing={false}
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
                        totalTimers={(timerTargetPhase?.timers || []).length}
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
                          const timerCount = (timerTargetPhase?.timers || []).length;
                          if (timerCount > 1) {
                            setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
                          }
                        }}
                        onNext={() => {
                          const timerCount = (timerTargetPhase?.timers || []).length;
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
                  recommendedIds={viewedPhaseRecommendedSoundIds}
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
        isEditorMode={state.isEditorMode}
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
        currentPhase={timerTargetPhase}
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
        onApplySync={handleApplySyncConfig}
        syncConfig={normalizeSyncConfig(state.syncConfig)}
        activeTimer={activeTimer}
        activeTimerState={activeTimerState}
        onToggleTimer={onToggleTimer}
        onResetTimer={onResetTimer}
        onResetSync={handleResetSync}
        quotaExceeded={quotaExceeded}
        pdfPageStates={state.pdfPageStates || EMPTY_PDF_PAGE_STATES}
        onSetPdfPage={handleSetPdfPageState}
        onAddPdfAsset={handleAddDropboxPdfAsset}
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
        onStopAllAudio={handleStopAllSounds}
        onResetTimer={() => onResetTimer()}
        onToggleEditorMode={toggleEditorMode}
        onOpenPhaseSearch={() => setIsPhaseSearchOpen(true)}
        onOpenSyncModal={() => setShowSyncModal(true)}
        onOpenPreferences={() => setShowPreferences(true)}
        isEditorMode={state.isEditorMode}
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

      {pendingScenarioSwitch && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#0b0b0d] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={22} />
              <div>
                <h3 className="text-sm font-bold tracking-wider text-amber-300">シナリオを切り替えますか？</h3>
                <p className="mt-3 text-xs leading-relaxed text-white/65">
                  現在のシナリオの進行状況・タイマー状態を保存して切り替えます。<br />
                  <span className="font-mono text-white/85">{state.currentScenario.title}</span> → <span className="font-mono text-white/85">{pendingScenarioSwitch.title}</span>
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => { setPendingScenarioSwitch(null); restoreScenarioUrl(); }} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-white/60 hover:bg-white/5 hover:text-white">キャンセル</button>
              <button onClick={confirmPendingScenarioSwitch} className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500">切り替える</button>
            </div>
          </div>
        </div>,
        document.body,
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
      <NetworkToast />
    </div>
  );
}

export default App;
