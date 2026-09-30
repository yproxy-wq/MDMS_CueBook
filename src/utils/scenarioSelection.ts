import { INITIAL_SCENARIO } from '../constants';
import type { Scenario } from '../types';

/** Resolve a scenario selected by its registry/storage key, including built-in data not persisted yet. */
export function resolveScenarioForSelection(scenarioId: string, storedScenario: Scenario | null): Scenario | null {
  if (storedScenario) {
    // The IndexedDB key is the lookup identity. Older cloud-setting merges could
    // leave a different id inside the stored object; retain its content under
    // the selected registry identity instead of silently selecting another row.
    return storedScenario.id === scenarioId ? storedScenario : { ...storedScenario, id: scenarioId };
  }

  // The guide is bundled with the app and can appear in the registry from the
  // initial in-memory state before its first autosave reaches IndexedDB.
  return scenarioId === INITIAL_SCENARIO.id ? INITIAL_SCENARIO : null;
}
