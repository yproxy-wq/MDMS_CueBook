import { Scenario, ScenarioSnapshot } from '../types';
import { INITIAL_SCENARIO, BLANK_SCENARIO } from '../constants';

/**
 * Simple and robust deep equality check. Handles primitive values, arrays, and plain objects.
 */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  
  const arrayA = Array.isArray(a);
  const arrayB = Array.isArray(b);
  if (arrayA !== arrayB) return false;
  
  if (arrayA) {
    const arrA = a as unknown[];
    const arrB = b as unknown[];
    if (arrA.length !== arrB.length) return false;
    for (let i = 0; i < arrA.length; i++) {
      if (!isDeepEqual(arrA[i], arrB[i])) return false;
    }
    return true;
  }
  
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isDeepEqual(objA[key], objB[key])) return false;
  }
  
  return true;
}

/**
 * Extracts only modified fields compared to the corresponding baseline scenario template,
 * dramatically minimizing serialized size and preventing Firestore write limit overflows.
 * Also prunes any nested snapshots list inside the snapshot's scenario data.
 */
export function getScenarioDiff(target: Scenario): Partial<Scenario> {
  if (!target || typeof target !== 'object') return {};
  
  const id = target.id || 'cuebook-blank';
  const isGuides = id === 'cuebook-manual';
  const base = isGuides ? INITIAL_SCENARIO : BLANK_SCENARIO;

  const diff: Partial<Scenario> = { id };
  const diffRecord = diff as Record<string, unknown>;

  // Keys to check and diff
  const keysToDiff: (keyof Scenario)[] = [
    'title',
    'author',
    'themeColor',
    'subThemeColor',
    'checklistPosition',
    'masterVolumePosition',
    'columnLayoutMode',
    'uiScaleMode',
    'popupTimerPosition',
    'backgroundImage',
    'rules',
    'outline',
    'branchId',
    'phases',
    'sounds',
    'characters',
    'images',
    'playerImages',
    'soundClusters',
    'syncConfig',
    'keyboardShortcuts',
    'layoutPreset',
    'timerDisplayPosition',
    'progressNavPosition',
    'editorToolbarPosition',
    'timerEndSoundEnabled',
    'timerEndSoundUrl',
    'timerFlashOnPauseEnabled',
    'phaseAutoScrollEnabled',
    'scriptFontSize',
    'audioPreferences'
  ];

  for (const key of keysToDiff) {
    if (key in target) {
      const baseVal = base[key];
      const targetVal = target[key];
      
      // If the target value differs from the baseline template, store it.
      if (!isDeepEqual(baseVal, targetVal)) {
        // Deep clone the stored value to keep isolation
        diffRecord[key as string] = JSON.parse(JSON.stringify(targetVal));
      }
    }
  }

  return diff;
}

/**
 * Reconstructs the full scenario object by merging the differential diff structure 
 * on top of the correct baseline scenario (INITIAL_SCENARIO or BLANK_SCENARIO).
 */
export function reconstructScenario(diff: Partial<Scenario> | undefined | null): Scenario {
  if (!diff || typeof diff !== 'object') {
    return JSON.parse(JSON.stringify(BLANK_SCENARIO));
  }

  const id = diff.id || 'cuebook-blank';
  const isGuides = id === 'cuebook-manual';
  const base = isGuides ? INITIAL_SCENARIO : BLANK_SCENARIO;

  // Clone base to keep absolute isolation & prevent mutation of default constants
  const baseClone = JSON.parse(JSON.stringify(base));

  return {
    ...baseClone,
    ...diff,
    // Always guarantee that snapshots are cleared/undefined in the restored object
    snapshots: undefined
  };
}

/**
 * Automatically limits the snapshots array to a maximum of 10 snapshots using FIFO (First-In-First-Out).
 * Keeps the 10 most recent snapshots (at the end of the array) and discards older ones.
 * Automatically applies the differential compression to preserve bandwidth and storage quota.
 */
export function limitSnapshots(
  currentSnapshots: ScenarioSnapshot[],
  newSnapshot: ScenarioSnapshot,
  maxLimit: number = 10
): ScenarioSnapshot[] {
  const updatedSnapshots = [...currentSnapshots, newSnapshot];
  let toKeep = updatedSnapshots;
  if (toKeep.length > maxLimit) {
    toKeep = toKeep.slice(toKeep.length - maxLimit);
  }
  
  return toKeep.map(s => {
    const sClone = { ...s };
    if (sClone.scenarioData && typeof sClone.scenarioData === 'object') {
      if ('snapshots' in sClone.scenarioData) {
        const dataCopy = { ...sClone.scenarioData };
        delete dataCopy.snapshots;
        sClone.scenarioData = dataCopy;
      }
      sClone.scenarioData = getScenarioDiff(sClone.scenarioData) as Scenario;
    }
    return sClone;
  });
}

/**
 * Manages human manual snapshots and machine automatic snapshots with independent buffer limits:
 * - Manual snapshots (max 10)
 * - Automatic snapshots starting with "[自動" (max 5)
 * Returns a time-ordered combined array without overflowing either buffer.
 * Automatically applies the differential compression to preserve bandwidth and storage quota.
 */
export function addSmartSnapshot(
  currentSnapshots: ScenarioSnapshot[],
  newSnapshot: ScenarioSnapshot,
  maxManualLimit: number = 10,
  maxAutoLimit: number = 5
): ScenarioSnapshot[] {
  const list = [...currentSnapshots, newSnapshot];

  // Distinguish automated vs manual
  const autos = list.filter(s => s.label.startsWith('[自動'));
  const manuals = list.filter(s => !s.label.startsWith('[自動'));

  // Truncate automatic snapshots if they overflow
  let autosToKeep = [...autos];
  if (autosToKeep.length > maxAutoLimit) {
    autosToKeep = autosToKeep.slice(autosToKeep.length - maxAutoLimit);
  }
  const autoIdsToKeep = new Set(autosToKeep.map(s => s.id));

  // Truncate manual snapshots if they overflow
  let manualsToKeep = [...manuals];
  if (manualsToKeep.length > maxManualLimit) {
    manualsToKeep = manualsToKeep.slice(manualsToKeep.length - maxManualLimit);
  }
  const manualIdsToKeep = new Set(manualsToKeep.map(s => s.id));

  // Filter and map to compress via 'Differential Save'
  return list.filter(s => {
    if (s.label.startsWith('[自動')) {
      return autoIdsToKeep.has(s.id);
    } else {
      return manualIdsToKeep.has(s.id);
    }
  }).map(s => {
    const sClone = { ...s };
    if (sClone.scenarioData && typeof sClone.scenarioData === 'object') {
      if ('snapshots' in sClone.scenarioData) {
        const dataCopy = { ...sClone.scenarioData };
        delete dataCopy.snapshots;
        sClone.scenarioData = dataCopy;
      }
      sClone.scenarioData = getScenarioDiff(sClone.scenarioData) as Scenario;
    }
    return sClone;
  });
}
