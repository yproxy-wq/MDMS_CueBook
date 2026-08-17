import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { AppState, Scenario } from '../types';
import { storageService } from '../services/StorageService';
import {
  applyScenarioSettings,
  createScenarioBinding,
  fingerprintScenario,
  readCloudScenarios,
  type ScenarioRegistryEntry,
} from '../services/ScenarioRegistryService';
import { limitScenarioCatalogEntries } from '../utils/scenarioCatalog';
import { DEMO_DARUMA_SCENARIO, DEMO_SCENARIO } from '../constants';
import { errorLogger } from '../services/ErrorLogger';

interface UseScenarioRegistryOptions {
  isReady: boolean;
  user: User | null;
  currentScenarioRef: MutableRefObject<Scenario>;
  setState: Dispatch<SetStateAction<AppState>>;
}

export function useScenarioRegistry({ isReady, user, currentScenarioRef, setState }: UseScenarioRegistryOptions) {
  const [scenarioEntries, setScenarioEntries] = useState<ScenarioRegistryEntry[]>([]);

  const refreshScenarioRegistry = useCallback(async () => {
    if (!isReady) return;
    try {
      const keys = await storageService.listScenarioKeys();
      for (const demoScenario of [DEMO_SCENARIO, DEMO_DARUMA_SCENARIO]) {
        if (!keys.includes(demoScenario.id)) await storageService.saveScenario(demoScenario.id, demoScenario);
      }
      const localEntries = new Map<string, ScenarioRegistryEntry>();
      for (const key of [...keys, DEMO_SCENARIO.id, DEMO_DARUMA_SCENARIO.id]) {
        if (key === 'gm_accomplice_scenario') continue;
        const localScenario = await storageService.loadScenario(key);
        if (!localScenario?.id) continue;
        const binding = await storageService.loadBinding(localScenario.id);
        if (!binding) {
          await createScenarioBinding(localScenario, `${localScenario.title || localScenario.id}.json`, localScenario.id);
        }
        localEntries.set(localScenario.id, {
          scenarioId: localScenario.id,
          title: localScenario.title || localScenario.id,
          fileFingerprint: await fingerprintScenario(localScenario),
          updatedAt: localScenario.lastUpdated || 0,
          availability: 'available',
          localScenarioKey: localScenario.id,
          source: 'local',
        });
      }

      const currentScenario = currentScenarioRef.current;
      if (currentScenario.id && !localEntries.has(currentScenario.id)) {
        localEntries.set(currentScenario.id, {
          scenarioId: currentScenario.id,
          title: currentScenario.title || currentScenario.id,
          fileFingerprint: await fingerprintScenario(currentScenario),
          updatedAt: currentScenario.lastUpdated || 0,
          availability: 'available',
          localScenarioKey: currentScenario.id,
          source: 'local',
        });
      }

      const cloudEntries = await readCloudScenarios(user).catch(error => {
        console.warn('Scenario registry: cloud list unavailable; using local catalog.', error);
        errorLogger.logOperationError(error, {
          code: 'SCENARIO_REGISTRY_CLOUD_UNAVAILABLE', operation: 'scenario.registry.readCloud', recoverable: true,
          scenarioId: currentScenarioRef.current.id,
        });
        return [];
      });
      for (const cloud of cloudEntries) {
        const local = localEntries.get(cloud.scenarioId);
        localEntries.set(cloud.scenarioId, {
          scenarioId: cloud.scenarioId,
          title: cloud.title || local?.title || cloud.scenarioId,
          fileNameHint: cloud.fileNameHint,
          fileFingerprint: cloud.fileFingerprint || local?.fileFingerprint,
          updatedAt: Math.max(cloud.updatedAt || 0, local?.updatedAt || 0),
          availability: local
            ? (cloud.fileFingerprint && local.fileFingerprint && cloud.fileFingerprint !== local.fileFingerprint ? 'mismatch' : 'available')
            : 'unbound',
          localScenarioKey: local?.localScenarioKey,
          source: local ? 'both' : 'cloud',
          settings: cloud.settings,
        });
      }
      const currentCloud = cloudEntries.find(item => item.scenarioId === currentScenarioRef.current.id);
      if (currentCloud?.settings) {
        setState(previous => ({
          ...previous,
          currentScenario: applyScenarioSettings(previous.currentScenario, currentCloud.settings),
          syncConfig: currentCloud.settings?.syncConfig || previous.syncConfig,
        }));
      }
      setScenarioEntries(limitScenarioCatalogEntries(Array.from(localEntries.values()), currentScenarioRef.current.id));
    } catch (error) {
      console.error('Scenario registry refresh failed:', error);
      errorLogger.logOperationError(error, {
        code: 'SCENARIO_REGISTRY_REFRESH_FAILED', operation: 'scenario.registry.refresh', recoverable: true,
        scenarioId: currentScenarioRef.current.id,
      });
    }
  }, [currentScenarioRef, isReady, setState, user]);

  useEffect(() => {
    void refreshScenarioRegistry();
  }, [refreshScenarioRegistry]);

  return { scenarioEntries, refreshScenarioRegistry };
}
