
import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { AppState, Phase } from '../types';
import { syncService, TimerSyncData } from '../services/SyncService';
import { isQuotaExceeded } from '../lib/firebase';
import { findSyncMediaResource, transformDropboxUrl } from '../utils/mediaHelper';
import { createTimerSessionId, isSecureShareId } from '../utils/syncHelper';
import { getPdfPageStateKey } from '../utils/pdfAssetHelper';

interface LastSyncTracker {
  time: number;
  seconds: number;
  isRunning: boolean;
  timerId: string;
  imageId: string | null;
  phaseId: string;
  syncTimerEnabled: boolean;
  syncContentEnabled: boolean;
  timerSize: 'small' | 'medium' | 'large';
  timerPosition: 'top' | 'bottom';
  imageFit: 'contain' | 'cover' | 'fill' | 'width' | 'height';
  timerForceHidden: boolean;
  lapTimes: number[];
  lapTexts: Record<number, string>;
  lapDisplayMode: 'hidden' | 'overlay' | 'persistent';
  lapDisplayPosition: 'top' | 'bottom';
  lapNotificationText: string;
  overlayType?: 'black' | 'white' | 'none';
  overlayIntensity?: number;
  timerColor?: 'black' | 'white';
  lapBandSize?: 'small' | 'medium' | 'large';
  lapFontSize?: 'small' | 'medium' | 'large';
  timerLabelText?: string;
  pdfAssetId?: string | null;
  pdfPage?: number | null;
}

const lastSyncCache: Record<string, LastSyncTracker> = {};
const syncWriteSequences: Record<string, number> = {};

export function useTimerSync(
  user: User | null,
  state: AppState,
  isEditorMode: boolean,
  currentPhase: Phase | undefined,
  activeTimerIndex: number,
) {
  const [syncData, setSyncData] = useState<TimerSyncData | null>(null);

  // Subscribe to remote updates
  useEffect(() => {
    const shareId = state.currentScenario.syncShareId;
    if (!user || !isSecureShareId(shareId)) return;
    const sessionId = createTimerSessionId(user.uid, shareId);
    return syncService.subscribeToTimer(sessionId, (data) => {
      setSyncData(data);
    });
  }, [user, state.currentScenario.syncShareId]);

  // Sync local state to remote
  useEffect(() => {
    const shareId = state.currentScenario.syncShareId;
    if (!user || !isSecureShareId(shareId)) return;

    const activeTimer = currentPhase?.timers?.[activeTimerIndex] || currentPhase?.timers?.[0];
    if (!activeTimer) return;

    const timerState = state.timerStates[activeTimer.id];
    if (!timerState) return;

    const sessionId = createTimerSessionId(user.uid, shareId);
    
    // We only want to update Firestore if something "meaningful" changed
    // or if enough time has passed (heartbeat).
    
    const lastSync = lastSyncCache[sessionId] || { 
      time: 0, 
      seconds: 0, 
      isRunning: false, 
      timerId: '', 
      imageId: null as string | null, 
      phaseId: '',
      syncTimerEnabled: true,
      syncContentEnabled: true,
      timerSize: 'small' as 'small' | 'medium' | 'large',
      timerPosition: 'bottom' as 'top' | 'bottom',
      imageFit: 'cover' as 'contain' | 'cover' | 'fill' | 'width' | 'height',
      timerForceHidden: false,
      lapTimes: [] as number[],
      lapDisplayMode: 'overlay' as 'hidden' | 'overlay' | 'persistent',
      lapDisplayPosition: 'top' as 'top' | 'bottom',
      lapNotificationText: '',
      overlayType: 'none' as 'black' | 'white' | 'none',
      overlayIntensity: 0.5,
      timerColor: 'white' as 'black' | 'white',
      lapBandSize: 'medium' as 'small' | 'medium' | 'large',
      lapFontSize: 'medium' as 'small' | 'medium' | 'large',
       timerLabelText: '',
       pdfAssetId: null,
       pdfPage: null,
       lapTexts: {},
    };
    const now = Date.now();
    const timeSinceLastSync = now - lastSync.time;
    
    // Stop syncing if quota is exceeded to prevent infinite error loops
    if (isQuotaExceeded()) return;

    const secondsDiff = Math.abs(timerState.seconds - lastSync.seconds);
    const currentImageId = state.syncConfig ? state.syncConfig.activeImageId : state.activeImageId;
    const normalizedActiveImageId = currentImageId ? String(currentImageId).trim() : null;
    const currentMediaItem = findSyncMediaResource(state.currentScenario, normalizedActiveImageId);
    const currentPdfPage = currentMediaItem?.type === 'pdf'
      ? (state.pdfPageStates?.[getPdfPageStateKey(currentMediaItem)] || 1)
      : null;
    const currentPdfAssetId = currentMediaItem?.type === 'pdf' ? currentMediaItem.assetId || null : null;
    
    // Setup and evaluate current UI configurations locally
    const currentSyncTimerEnabled = state.syncConfig?.timerEnabled ?? true;
    const currentSyncContentEnabled = state.syncConfig?.contentEnabled ?? true;
    const currentTimerSize = state.syncConfig?.timerSize || 'small';
    const currentTimerPosition = state.syncConfig?.timerPosition || 'bottom';
    const currentImageFit = state.syncConfig?.imageFit || 'cover';
    const currentTimerForceHidden = state.syncConfig?.timerForceHidden ?? false;
    const currentLapDisplayMode = state.syncConfig?.lapDisplayMode || 'overlay';
    const currentLapDisplayPosition = state.syncConfig?.lapDisplayPosition || 'top';
    const currentLapNotificationText = state.syncConfig?.lapNotificationText ?? activeTimer.lapNotificationText ?? '';
    const currentOverlayType = state.syncConfig?.overlayType || 'none';
    const currentOverlayIntensity = state.syncConfig?.overlayIntensity ?? 0.5;
    const currentTimerColor = state.syncConfig?.timerColor || 'white';
    const currentLapBandSize = state.syncConfig?.lapBandSize || 'medium';
    const currentLapFontSize = state.syncConfig?.lapFontSize || 'medium';
    const currentTimerLabelText = state.syncConfig?.timerLabelText || '';

    const currentLapTimesStr = JSON.stringify(activeTimer.lapTimes || []);
    const lastLapTimesStr = JSON.stringify(lastSync.lapTimes || []);
    const lapTimesChanged = currentLapTimesStr !== lastLapTimesStr;

    const currentLapTextsStr = JSON.stringify(activeTimer.lapTexts || {});
    const lastLapTextsStr = JSON.stringify(lastSync.lapTexts || {});
    const lapTextsChanged = currentLapTextsStr !== lastLapTextsStr;

    // Check if configuration actually changed vs our own last sync (rather than Firestore's remote syncData)
    // This absolutely isolates local write actions from remote snapshots, avoiding cross-tab syncing ping-pongs.
    const configChanged = 
      currentSyncTimerEnabled !== lastSync.syncTimerEnabled ||
      currentSyncContentEnabled !== lastSync.syncContentEnabled ||
      currentTimerSize !== lastSync.timerSize ||
      currentTimerPosition !== lastSync.timerPosition ||
      currentImageFit !== lastSync.imageFit ||
      currentTimerForceHidden !== lastSync.timerForceHidden ||
      currentLapDisplayMode !== lastSync.lapDisplayMode ||
      currentLapDisplayPosition !== lastSync.lapDisplayPosition ||
      currentLapNotificationText !== lastSync.lapNotificationText ||
      currentOverlayType !== lastSync.overlayType ||
      currentOverlayIntensity !== lastSync.overlayIntensity ||
      currentTimerColor !== lastSync.timerColor ||
      currentLapBandSize !== lastSync.lapBandSize ||
      currentLapFontSize !== lastSync.lapFontSize ||
       currentTimerLabelText !== lastSync.timerLabelText ||
       currentPdfAssetId !== lastSync.pdfAssetId ||
       currentPdfPage !== lastSync.pdfPage ||
       lapTimesChanged ||
      lapTextsChanged;

    const hasStatusChanged = 
      timerState.isRunning !== lastSync.isRunning ||
      activeTimer.id !== lastSync.timerId ||
      state.currentPhaseId !== lastSync.phaseId;

    const hasConfigChanged = configChanged || normalizedActiveImageId !== lastSync.imageId;

    // CRITICAL: If the timer is RUNNING, we don't sync for minor drift (>= 2s).
    // Clients calculate their own time based on startTime. 
    // We only sync manual adjustments if the timer is STOPPED.
    const isManualAdjustment = !timerState.isRunning && secondsDiff > 2;
    // Heartbeat every 10 minutes to maintain session without burning too much quota. 
    // Usually status changes keep it fresh anyway.
    const isHeartbeat = timeSinceLastSync > 600000;

    const shouldSync = hasStatusChanged || hasConfigChanged || isManualAdjustment || isHeartbeat;

    if (isEditorMode) {
      const isManualTimerAction = timerState.isRunning !== lastSync.isRunning || isManualAdjustment;
      if (!hasConfigChanged && !isManualTimerAction) {
        return;
      }
    }
    if (!shouldSync) return;

    // Visibility Check: Prioritize focused tab to prevent "Fighting Heartbeats"
    if (document.visibilityState === 'hidden' && !hasStatusChanged && !hasConfigChanged) {
      return;
    }

    // PREVENT SYNC LOOPS: 
    // If the data we're about to send is identical to what's already on the server, skip it.
    const remoteData = syncData || ({} as Partial<TimerSyncData>);

    const mediaItem = currentMediaItem;

    const prepareDataToSync = (): TimerSyncData => ({
      scenarioId: state.currentScenario.id,
      phaseId: state.currentPhaseId,
      timerId: activeTimer.id,
      remainingSeconds: timerState.seconds,
      isRunning: timerState.isRunning,
      startTime: timerState.startTime || null,
      label: activeTimer.label || null,
      activeImageId: normalizedActiveImageId,
      activeImageUrl: mediaItem?.assetId ? null : (mediaItem?.url ? transformDropboxUrl(mediaItem.url) : null),
      activeImageName: mediaItem?.name || null,
      activeResourceType: mediaItem?.type || (normalizedActiveImageId ? 'image' : null),
      pdfPage: currentPdfPage,
      pdfAssetId: currentPdfAssetId,
      pdfPageCount: mediaItem?.type === 'pdf' ? mediaItem.pageCount || null : null,
      syncTimerEnabled: currentSyncTimerEnabled,
      syncContentEnabled: currentSyncContentEnabled,
      timerSize: currentTimerSize,
      timerPosition: currentTimerPosition,
      imageFit: currentImageFit,
      timerForceHidden: currentTimerForceHidden,
      videoPlaying: state.syncConfig?.videoPlaying ?? (remoteData?.videoPlaying ?? false),
      videoProgress: state.syncConfig?.videoProgress ?? (remoteData?.videoProgress ?? 0),
      videoDuration: state.syncConfig?.videoDuration ?? (remoteData?.videoDuration ?? 0),
      videoVolume: state.syncConfig?.videoVolume ?? (remoteData?.videoVolume ?? 1),
      videoLoop: state.syncConfig?.videoLoop ?? (remoteData?.videoLoop ?? false),
      lapTimes: activeTimer.lapTimes || null,
      lapTexts: activeTimer.lapTexts || null,
      lapDisplayMode: currentLapDisplayMode,
      lapDisplayPosition: currentLapDisplayPosition,
      lapNotificationText: currentLapNotificationText || null,
      overlayType: currentOverlayType,
      overlayIntensity: currentOverlayIntensity,
      timerColor: currentTimerColor,
      lapBandSize: currentLapBandSize,
      lapFontSize: currentLapFontSize,
      timerLabelText: currentTimerLabelText || null,
    });

    const dataToSync = prepareDataToSync();

    // Deep compare check (simple version)
    const isDataIdentical = (local: TimerSyncData, remote: Partial<TimerSyncData>) => {
      // Normalize values for robust comparison
      const normalize = (val: unknown) => {
        if (val === undefined || val === null) return null;
        const s = String(val).trim();
        return s === '' ? null : s;
      };
      const numOrNull = (val: unknown) => (val === undefined || val === null) ? null : Number(val);
      
      const scenarioMatched = normalize(local.scenarioId) === normalize(remote.scenarioId);
      const phaseMatched = normalize(local.phaseId) === normalize(remote.phaseId);
      const timerMatched = normalize(local.timerId) === normalize(remote.timerId);
      const runningMatched = local.isRunning === remote.isRunning;
      const startMatched = numOrNull(local.startTime) === numOrNull(remote.startTime);
      
      // OPTIMIZATION: If the timer is running and the start time is the same, 
      // we DON'T consider it a change even if remainingSeconds differ locally.
      // Remote clients calculate time based on startTime.
      const timeMatched = local.isRunning 
        ? startMatched 
        : (numOrNull(local.remainingSeconds) === numOrNull(remote.remainingSeconds));

      const localLapTimesStr = JSON.stringify(local.lapTimes || []);
      const remoteLapTimesStr = JSON.stringify(remote.lapTimes || []);
      const lapTimesMatched = localLapTimesStr === remoteLapTimesStr;

      const localLapTextsStr = JSON.stringify(local.lapTexts || {});
      const remoteLapTextsStr = JSON.stringify(remote.lapTexts || {});
      const lapTextsMatched = localLapTextsStr === remoteLapTextsStr;

      return scenarioMatched && phaseMatched && timerMatched && runningMatched && timeMatched && 
              normalize(local.activeImageId) === normalize(remote.activeImageId) &&
              normalize(local.pdfAssetId) === normalize(remote.pdfAssetId) &&
              numOrNull(local.pdfPage) === numOrNull(remote.pdfPage) &&
              numOrNull(local.pdfPageCount) === numOrNull(remote.pdfPageCount) &&
              (local.syncTimerEnabled ?? true) === (remote.syncTimerEnabled ?? true) &&
             (local.syncContentEnabled ?? true) === (remote.syncContentEnabled ?? true) &&
             (local.timerSize || 'small') === (remote.timerSize || 'small') &&
             (local.timerPosition || 'bottom') === (remote.timerPosition || 'bottom') &&
             (local.imageFit || 'cover') === (remote.imageFit || 'cover') &&
             (local.timerForceHidden ?? false) === (remote.timerForceHidden ?? false) &&
             (local.videoPlaying ?? false) === (remote.videoPlaying ?? false) &&
             (local.videoProgress ?? 0) === (remote.videoProgress ?? 0) &&
             (local.videoDuration ?? 0) === (remote.videoDuration ?? 0) &&
             (local.videoVolume ?? 1) === (remote.videoVolume ?? 1) &&
             (local.videoLoop ?? false) === (remote.videoLoop ?? false) &&
             (local.lapDisplayMode || 'overlay') === (remote.lapDisplayMode || 'overlay') &&
             (local.lapDisplayPosition || 'top') === (remote.lapDisplayPosition || 'top') &&
             normalize(local.lapNotificationText) === normalize(remote.lapNotificationText) &&
             (local.overlayType || 'none') === (remote.overlayType || 'none') &&
             local.overlayIntensity === remote.overlayIntensity &&
             (local.timerColor || 'white') === (remote.timerColor || 'white') &&
             (local.lapBandSize || 'medium') === (remote.lapBandSize || 'medium') &&
             (local.lapFontSize || 'medium') === (remote.lapFontSize || 'medium') &&
             normalize(local.timerLabelText) === normalize(remote.timerLabelText) &&
             lapTimesMatched &&
             lapTextsMatched;
    };

    const isRedundant = isDataIdentical(dataToSync, remoteData);

    if (isRedundant && !isHeartbeat) {
      if (lastSyncCache[sessionId]) {
        lastSyncCache[sessionId].time = now;
      }
      return;
    }

    const nextSyncCache: LastSyncTracker = {
      time: now,
      seconds: timerState.seconds,
      isRunning: timerState.isRunning,
      timerId: activeTimer.id,
      imageId: normalizedActiveImageId,
      phaseId: state.currentPhaseId,
      syncTimerEnabled: currentSyncTimerEnabled,
      syncContentEnabled: currentSyncContentEnabled,
      timerSize: currentTimerSize,
      timerPosition: currentTimerPosition,
      imageFit: currentImageFit,
      timerForceHidden: currentTimerForceHidden,
      lapTimes: activeTimer.lapTimes || [],
      lapTexts: activeTimer.lapTexts || {},
      lapDisplayMode: currentLapDisplayMode,
      lapDisplayPosition: currentLapDisplayPosition,
      lapNotificationText: currentLapNotificationText,
      overlayType: currentOverlayType,
      overlayIntensity: currentOverlayIntensity,
      timerColor: currentTimerColor,
      lapBandSize: currentLapBandSize,
      lapFontSize: currentLapFontSize,
      timerLabelText: currentTimerLabelText,
      pdfAssetId: currentPdfAssetId,
      pdfPage: currentPdfPage,
    };

    // CRITICAL: Status changes (Start/Stop) or manual timer adjustments should be INSTANT.
    // Configuration adjustments, layout choices, and media swaps are debounced to prevent Firestore write spikes.
    const writeSequence = (syncWriteSequences[sessionId] || 0) + 1;
    syncWriteSequences[sessionId] = writeSequence;
    const writePromise = hasStatusChanged || isManualAdjustment
      ? syncService.setTimerInstant(sessionId, dataToSync)
      : syncService.updateTimer(sessionId, dataToSync);

    // Treat the local snapshot as synchronized only after durable completion.
    void writePromise.then(() => {
      if (syncWriteSequences[sessionId] === writeSequence) {
        lastSyncCache[sessionId] = nextSyncCache;
      }
    }).catch((error) => {
      if (syncWriteSequences[sessionId] === writeSequence) {
        delete lastSyncCache[sessionId];
      }
      console.warn('[Sync] Durable write failed; the next state change will retry:', error);
    });
  }, [
    state.timerStates, 
    state.currentPhaseId, 
    activeTimerIndex, 
    user, 
    isEditorMode, 
    state.currentScenario,
    currentPhase?.timers, 
    state.activeImageId, 
    state.pdfPageStates,
    state.syncConfig,
    syncData
  ]);

  const forceSync = () => {
    const shareId = state.currentScenario.syncShareId;
    if (!user || !isSecureShareId(shareId)) return;
    
    const activeTimer = currentPhase?.timers?.[activeTimerIndex] || currentPhase?.timers?.[0];
    if (!activeTimer) return;

    const timerState = state.timerStates[activeTimer.id];
    if (!timerState) return;

    const sessionId = createTimerSessionId(user.uid, shareId);
    
    // Clear cache to bypass redundant check
    if (lastSyncCache[sessionId]) {
      lastSyncCache[sessionId].time = 0;
    }

    const currentImageId = state.syncConfig ? state.syncConfig.activeImageId : state.activeImageId;
    const normalizedActiveImageId = currentImageId ? String(currentImageId).trim() : null;
    const mediaItem = findSyncMediaResource(state.currentScenario, normalizedActiveImageId);

    const dataToSync: TimerSyncData = {
      scenarioId: state.currentScenario.id,
      phaseId: state.currentPhaseId,
      timerId: activeTimer.id,
      remainingSeconds: timerState.seconds,
      isRunning: timerState.isRunning,
      startTime: timerState.startTime || null,
      label: activeTimer.label || null,
      activeImageId: normalizedActiveImageId,
      activeImageUrl: mediaItem?.assetId ? null : (mediaItem?.url ? transformDropboxUrl(mediaItem.url) : null),
      activeImageName: mediaItem?.name || null,
      activeResourceType: mediaItem?.type || (normalizedActiveImageId ? 'image' : null),
      pdfPage: mediaItem?.type === 'pdf' ? (state.pdfPageStates?.[getPdfPageStateKey(mediaItem)] || 1) : null,
      pdfAssetId: mediaItem?.type === 'pdf' ? mediaItem.assetId || null : null,
      pdfPageCount: mediaItem?.type === 'pdf' ? mediaItem.pageCount || null : null,
      syncTimerEnabled: state.syncConfig?.timerEnabled ?? (syncData?.syncTimerEnabled ?? true),
      syncContentEnabled: state.syncConfig?.contentEnabled ?? (syncData?.syncContentEnabled ?? true),
      timerSize: state.syncConfig?.timerSize || syncData?.timerSize || 'small',
      timerPosition: state.syncConfig?.timerPosition || syncData?.timerPosition || 'bottom',
      imageFit: state.syncConfig?.imageFit || syncData?.imageFit || 'cover',
      timerForceHidden: state.syncConfig?.timerForceHidden ?? (syncData?.timerForceHidden ?? false),
      videoPlaying: state.syncConfig?.videoPlaying ?? (syncData?.videoPlaying ?? false),
      videoProgress: state.syncConfig?.videoProgress ?? (syncData?.videoProgress ?? 0),
      videoDuration: state.syncConfig?.videoDuration ?? (syncData?.videoDuration ?? 0),
      videoVolume: state.syncConfig?.videoVolume ?? (syncData?.videoVolume ?? 1),
      videoLoop: state.syncConfig?.videoLoop ?? (syncData?.videoLoop ?? false),
      lapTimes: activeTimer.lapTimes || null,
      lapTexts: activeTimer.lapTexts || null,
      lapDisplayMode: state.syncConfig?.lapDisplayMode || syncData?.lapDisplayMode || 'overlay',
      lapDisplayPosition: state.syncConfig?.lapDisplayPosition || syncData?.lapDisplayPosition || 'top',
      lapNotificationText: state.syncConfig?.lapNotificationText ?? activeTimer.lapNotificationText ?? null,
      overlayType: state.syncConfig?.overlayType || syncData?.overlayType || 'none',
      overlayIntensity: state.syncConfig?.overlayIntensity ?? syncData?.overlayIntensity ?? 0.5,
      timerColor: state.syncConfig?.timerColor || syncData?.timerColor || 'white',
      lapBandSize: state.syncConfig?.lapBandSize || syncData?.lapBandSize || 'medium',
      lapFontSize: state.syncConfig?.lapFontSize || syncData?.lapFontSize || 'medium',
      timerLabelText: state.syncConfig?.timerLabelText || syncData?.timerLabelText || null,
    };

    syncService.setTimerInstant(sessionId, dataToSync).catch((error) => {
      console.warn('[Sync] Force sync write failed:', error);
    });
  };

  return { syncData, setSyncData, forceSync };
}
