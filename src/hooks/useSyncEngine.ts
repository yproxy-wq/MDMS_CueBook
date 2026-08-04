import { useEffect } from 'react';
import { User } from 'firebase/auth';
import { AppState, Phase } from '../types';
import { storageService } from '../services/StorageService';
import { INITIAL_SCENARIO } from '../constants';
import { useTimerSync } from './useTimerSync';
import { fingerprintScenario, legacyScenarioKey } from '../services/ScenarioRegistryService';

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

  // 1. Load initial scenario from IndexedDB on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        const requested = scenarioId ? await storageService.loadScenario(scenarioId) : null;
        const saved = requested || await storageService.loadScenario(legacyScenarioKey);
        const scenarioToLoad = storageService.migrateScenarioData(saved || INITIAL_SCENARIO);

        const initialTimers: Record<string, { seconds: number; isRunning: boolean; startTime: number | null }> = {};
        (scenarioToLoad.phases || []).forEach((p: Phase) => {
          (p.timers || []).forEach(t => {
            initialTimers[t.id] = { seconds: t.durationMinutes * 60, isRunning: false, startTime: null };
          });
        });
        
        setState(prev => ({
          ...prev,
          currentScenario: scenarioToLoad,
          currentPhaseId: scenarioToLoad.phases[0]?.id || '',
          previewPhaseId: scenarioToLoad.phases[0]?.id || '',
          timerStates: initialTimers,
          syncConfig: scenarioToLoad.syncConfig || prev.syncConfig
        }));
      } catch (e) {
        console.error("useSyncEngine: Failed to load scenario from IndexedDB:", e);
      } finally {
        setIsReady(true);
      }
    };
    initApp();
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
      persist().catch(e => console.error("useSyncEngine: Auto-save error:", e));
    }
  }, [state.currentScenario, isReady]);

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
