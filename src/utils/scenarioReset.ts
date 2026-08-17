import { v4 as uuidv4 } from 'uuid';
import type { Scenario, ScenarioSnapshot } from '../types';
import { addSmartSnapshot } from './snapshotHelper';

export function createResetScenarioWithSnapshot(
  currentScenario: Scenario,
  targetScenario: Scenario,
  labelPrefix: string,
  nowMs = Date.now(),
): Scenario {
  const date = new Date(nowMs);
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const snapshot: ScenarioSnapshot = {
    id: uuidv4(),
    label: `${labelPrefix} ${timeStr}`,
    timestamp: nowMs,
    scenarioData: { ...currentScenario },
  };

  return {
    ...targetScenario,
    snapshots: addSmartSnapshot(currentScenario.snapshots || [], snapshot),
  };
}
