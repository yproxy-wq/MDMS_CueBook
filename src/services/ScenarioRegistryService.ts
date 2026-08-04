import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { Scenario } from '../types';
import { storageService, ScenarioBinding } from './StorageService';
import { validateAndMigrateScenario } from '../utils/scenarioValidator';

export type ScenarioAvailability = 'available' | 'unbound' | 'mismatch' | 'syncing';

export interface ScenarioRegistryEntry {
  scenarioId: string;
  title: string;
  fileNameHint?: string;
  fileFingerprint?: string;
  updatedAt: number;
  availability: ScenarioAvailability;
  localScenarioKey?: string;
  source: 'local' | 'cloud' | 'both';
  settings?: ScenarioSettings;
}

export interface ScenarioCloudRecord {
  scenarioId: string;
  title: string;
  fileNameHint?: string;
  fileFingerprint?: string;
  updatedAt: number;
  settings?: ScenarioSettings;
}

export type ScenarioSettings = Pick<Scenario,
  'backgroundImage' | 'themeColor' | 'subThemeColor' | 'checklistPosition' |
  'masterVolumePosition' | 'editorToolbarPosition' | 'columnLayoutMode' |
  'layoutPreset' | 'uiScaleMode' | 'popupTimerPosition' | 'narrowAudioPanel' |
  'timerDisplayPosition' | 'progressNavPosition' | 'timerEndSoundEnabled' |
  'timerEndSoundUrl' | 'timerFlashOnPauseEnabled' | 'phaseAutoScrollEnabled' |
  'scriptFontSize' | 'audioPreferences' | 'syncConfig' | 'keyboardShortcuts' |
  'customShortcuts' | 'branchId'>;

const SETTINGS_KEYS: (keyof ScenarioSettings)[] = [
  'backgroundImage', 'themeColor', 'subThemeColor', 'checklistPosition',
  'masterVolumePosition', 'editorToolbarPosition', 'columnLayoutMode',
  'layoutPreset', 'uiScaleMode', 'popupTimerPosition', 'narrowAudioPanel',
  'timerDisplayPosition', 'progressNavPosition', 'timerEndSoundEnabled',
  'timerEndSoundUrl', 'timerFlashOnPauseEnabled', 'phaseAutoScrollEnabled',
  'scriptFontSize', 'audioPreferences', 'syncConfig', 'keyboardShortcuts',
  'customShortcuts', 'branchId',
];

const legacyScenarioKey = 'gm_accomplice_scenario';

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
};

const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.filter(item => item !== undefined).map(item => stripUndefined(item)) as T;
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) result[key] = stripUndefined(item);
    }
    return result as T;
  }
  return value;
};

export async function fingerprintScenario(scenario: Scenario): Promise<string> {
  // Fingerprints identify the local file revision, not account-level preferences.
  // Layout/audio/sync settings may legitimately change on another device without
  // requiring the user to re-bind the same local scenario file.
  const normalized = { ...scenario } as Partial<Scenario> & Record<string, unknown>;
  for (const key of SETTINGS_KEYS) delete normalized[key];
  normalized.lastUpdated = undefined;
  normalized.snapshots = undefined;
  const encoded = new TextEncoder().encode(stableJson(normalized));
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 2166136261;
  for (const byte of encoded) hash = Math.imul(hash ^ byte, 16777619);
  return `fnv1a-${(hash >>> 0).toString(16)}`;
}

export function extractScenarioSettings(scenario: Scenario): ScenarioSettings {
  const settings = {} as ScenarioSettings;
  for (const key of SETTINGS_KEYS) {
    const value = scenario[key];
    if (value !== undefined) settings[key] = value as never;
  }
  return settings;
}

export function applyScenarioSettings(scenario: Scenario, settings?: ScenarioSettings): Scenario {
  return settings ? { ...scenario, ...settings } : scenario;
}

export async function createScenarioBinding(
  scenario: Scenario,
  fileName: string,
  scenarioId = scenario.id,
): Promise<ScenarioBinding> {
  const fileFingerprint = await fingerprintScenario(scenario);
  const now = Date.now();
  const binding: ScenarioBinding = {
    scenarioId,
    localScenarioKey: scenarioId,
    fileName,
    fileFingerprint,
    boundAt: now,
    updatedAt: now,
  };
  await storageService.saveScenario(scenarioId, scenario);
  await storageService.saveBinding(binding);
  return binding;
}

export async function readCloudScenarios(user: User | null): Promise<ScenarioCloudRecord[]> {
  if (!user) return [];
  const snapshot = await getDocs(collection(db, 'users', user.uid, 'scenarios'));
  return snapshot.docs.map(item => {
    const data = item.data() as Partial<ScenarioCloudRecord>;
    return {
      scenarioId: item.id,
      title: typeof data.title === 'string' ? data.title : item.id,
      fileNameHint: data.fileNameHint,
      fileFingerprint: data.fileFingerprint,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
      settings: data.settings,
    };
  });
}

export async function writeCloudScenario(user: User | null, scenario: Scenario, fileNameHint?: string): Promise<void> {
  if (!user) return;
  const fingerprint = await fingerprintScenario(scenario);
  const record: ScenarioCloudRecord = {
    scenarioId: scenario.id,
    title: scenario.title || scenario.id,
    fileNameHint,
    fileFingerprint: fingerprint,
    updatedAt: Date.now(),
    settings: stripUndefined(extractScenarioSettings(scenario)),
  };
  await setDoc(doc(db, 'users', user.uid, 'scenarios', scenario.id), record, { merge: true });
}

export async function ensureLegacyLocalScenario(): Promise<Scenario | null> {
  const existing = await storageService.loadScenario(legacyScenarioKey);
  if (!existing) return null;
  const scenario = validateAndMigrateScenario(existing);
  if (scenario.id !== legacyScenarioKey) {
    const binding = await storageService.loadBinding(scenario.id);
    if (!binding) await createScenarioBinding(scenario, 'legacy-local-scenario', scenario.id);
  }
  return scenario;
}

export { legacyScenarioKey };
