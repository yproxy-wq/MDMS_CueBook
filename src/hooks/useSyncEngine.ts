import { useEffect } from 'react';
import { User } from 'firebase/auth';
import { AppState, Phase } from '../types';
import { storageService, ScenarioSessionSnapshot } from '../services/StorageService';
import { INITIAL_SCENARIO } from '../constants';
import { useTimerSync } from './useTimerSync';
import { fingerprintScenario, legacyScenarioKey } from '../services/ScenarioRegistryService';
import { createAsyncRequestGuard } from '../utils/asyncRequestGuard';
import { errorLogger } from '../services/ErrorLogger';

interface UseSyncEngineProps {
  user: User | null;
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  isReady: boolean;
  setIsReady: (ready: boolean) => void;
  activeTimerIndex: number;
  currentPhase: Phase | null | undefined;
  scenarioId?: string | null;
}

export function useSyncEngine({
  user,
  state,
  setState,
  isReady,
  setIsReady,
  activeTimerIndex,
  currentPhase,
  scenarioId
}: UseSyncEngineProps) {

  const createInitialTimers = (scenario: AppState['currentScenario']): AppState['timerStates'] => {
    const initialTimers: AppState['timerStates'] = {};
    (scenario.phases || []).forEach((p: Phase) => {
      (p.timers || []).forEach(t => {
        initialTimers[t.id] = { seconds: t.durationMinutes * 60, isRunning: false, startTime: null };
      });
    });
    return initialTimers;
  };

  // 1. Load initial scenario from IndexedDB on mount
  useEffect(() => {
    const requestGuard = createAsyncRequestGuard();
    setIsReady(false);

    const initApp = async () => {
      try {
        const requested = scenarioId ? await storageService.loadScenario(scenarioId) : null;
        if (!requestGuard.isActive()) return;
        const saved = requested || await storageService.loadScenario(legacyScenarioKey);
        if (!requestGuard.isActive()) return;
        const scenarioToLoad = storageService.migrateScenarioData(saved || INITIAL_SCENARIO);

        const initialTimers = createInitialTimers(scenarioToLoad);
        const savedSession = await storageService.loadSession(scenarioToLoad.id);
        if (!requestGuard.isActive()) return;
        
        setState(prev => ({
          ...prev,
          currentScenario: scenarioToLoad,
          currentPhaseId: savedSession?.currentPhaseId || scenarioToLoad.phases[0]?.id || '',
          previewPhaseId: savedSession?.previewPhaseId || scenarioToLoad.phases[0]?.id || '',
          timerStates: savedSession?.timerStates || initialTimers,
          phaseResults: savedSession?.phaseResults || {},
          phaseDurations: savedSession?.phaseDurations || {},
          activeImageId: savedSession?.activeImageId ?? null,
          gmActiveImageId: savedSession?.gmActiveImageId ?? null,
          sessionStartTime: savedSession?.sessionStartTime,
          phaseStartTime: savedSession?.phaseStartTime,
          exitTime: savedSession?.exitTime || prev.exitTime,
          isPaused: savedSession?.isPaused ?? false,
          syncConfig: savedSession?.syncConfig || scenarioToLoad.syncConfig || prev.syncConfig
        }));
      } catch (e) {
        if (requestGuard.isActive()) {
          console.error("useSyncEngine: Failed to load scenario from IndexedDB:", e);
          errorLogger.logOperationError(e, {
            code: 'SCENARIO_LOAD_FAILED', operation: 'scenario.load', recoverable: true, scenarioId: scenarioId || undefined,
          });
        }
      } finally {
        if (requestGuard.isActive()) setIsReady(true);
      }
    };
    initApp();

    return () => requestGuard.dispose();
  }, [scenarioId, setState, setIsReady]);

  // 2. Auto-save scenario edits to IndexedDB
  useEffect(() => {
    if (isReady) {
      const persist = async () => {
        await storageService.saveScenario(state.currentScenario.id, state.currentScenario);
        // Keep the legacy key alive for rollback compatibility while old clients exist.
        await storageService.saveScenario(legacyScenarioKey, state.currentScenario);
        const binding = await storageService.loadBinding(state.currentScenario.id);
        if (binding) {
          await storageService.saveBinding({
            ...binding,
            fileFingerprint: await fingerprintScenario(state.currentScenario),
            updatedAt: Date.now(),
          });
        }
      };
      persist().catch(e => {
        console.error("useSyncEngine: Auto-save error:", e);
        errorLogger.logOperationError(e, {
          code: 'SCENARIO_AUTOSAVE_FAILED', operation: 'scenario.autosave', recoverable: true,
          scenarioId: state.currentScenario.id,
        });
      });
    }
  }, [state.currentScenario, isReady]);

  // Progress is scoped by scenarioId. Saving only on state changes avoids a
  // per-second root update while preserving timer/phase state across switches.
  useEffect(() => {
    if (!isReady) return;
    const snapshot: ScenarioSessionSnapshot = {
      scenarioId: state.currentScenario.id,
      currentPhaseId: state.currentPhaseId,
      previewPhaseId: state.previewPhaseId,
      timerStates: state.timerStates,
      phaseResults: state.phaseResults,
      phaseDurations: state.phaseDurations,
      activeImageId: state.activeImageId,
      gmActiveImageId: state.gmActiveImageId,
      syncConfig: state.syncConfig,
      sessionStartTime: state.sessionStartTime,
      phaseStartTime: state.phaseStartTime,
      exitTime: state.exitTime,
      isPaused: state.isPaused,
      savedAt: Date.now(),
    };
    const timer = window.setTimeout(() => {
      storageService.saveSession(state.currentScenario.id, snapshot)
        .catch(error => {
          console.warn('useSyncEngine: Session progress save failed:', error);
          errorLogger.logOperationError(error, {
            code: 'SESSION_SAVE_FAILED', operation: 'session.save', recoverable: true,
            scenarioId: state.currentScenario.id,
          });
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    isReady,
    state.currentScenario.id,
    state.currentPhaseId,
    state.previewPhaseId,
    state.timerStates,
    state.phaseResults,
    state.phaseDurations,
    state.activeImageId,
    state.gmActiveImageId,
    state.syncConfig,
    state.sessionStartTime,
    state.phaseStartTime,
    state.exitTime,
    state.isPaused,
  ]);

  // 3. Handle Firestore real-time timer/media syncing (Delegating to useTimerSync)
  const { syncData, forceSync } = useTimerSync(
    user,
    state,
    state.isEditorMode,
    currentPhase || undefined,
    activeTimerIndex
  );

  return {
    syncData,
    forceSync
  };
}
