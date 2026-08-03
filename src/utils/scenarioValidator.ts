import { Scenario, Phase, SoundConfig, Character, SoundType, CharacterType, TimerConfig, SyncConfig } from '../types';

/**
 * ============================================================================
 * CUEBOOK DATA VALIDATOR & ATOMIC MIGRATION LAYER (ACID - Consistency Helper)
 * ============================================================================
 * Ensures scenarios are complete and structurally consistent before storage/sync.
 * Adheres to UNIX philosophy (simple modular pipes) and SOLID (SRP).
 * ============================================================================
 */

/**
 * Generates a standard lightweight fallback ID.
 */
function createFallbackId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Single-responsibility component to migrate a single script structure in a Phase (SRP).
 * Ensures "script -> scriptBlocks" consistent mapping (ACID Consistency).
 */
export function migratePhaseScript(phase: Partial<Phase>): Partial<Phase> {
  const updated = { ...phase };
  
  // If older raw script exists, map into structured blocks cleanly
  if (updated.script && (!updated.scriptBlocks || updated.scriptBlocks.length === 0)) {
    updated.scriptBlocks = [
      {
        id: createFallbackId(),
        type: 'markdown',
        content: updated.script
      }
    ];
  }
  
  // Fill missing arrays safely
  if (!updated.timers) updated.timers = [];
  if (!updated.recommendedSounds) updated.recommendedSounds = [];
  if (!updated.checklists) updated.checklists = [];

  return updated;
}

/**
 * Single-responsibility validator that normalizes a single Phase.
 */
export function normalizePhase(phase: unknown): Phase {
  const rawPhase = { ...(phase as Record<string, unknown>) } as Partial<Phase>;
  
  if (!rawPhase.id) rawPhase.id = createFallbackId();
  const phaseTitle = (rawPhase as { title?: string }).title || rawPhase.name || 'Untitled Phase';
  rawPhase.name = phaseTitle;
  (rawPhase as { title?: string }).title = phaseTitle;
  
  const migrated = migratePhaseScript(rawPhase);
  
  // Preserve timers array, ensuring each timer has required fields
  const rawTimers = migrated.timers || [];
  if (rawTimers.length > 0) {
    migrated.timers = rawTimers.map((t: unknown) => {
      const rt = (t || {}) as Partial<TimerConfig> & Record<string, unknown>;
      return {
        id: (rt.id as string) || createFallbackId(),
        label: (rt.label as string) || 'タイマー',
        durationMinutes: typeof rt.durationMinutes === 'number' ? rt.durationMinutes : 10,
        lapTimes: rt.lapTimes as number[] | undefined,
        lapNotificationText: rt.lapNotificationText as string | undefined,
        lapTexts: rt.lapTexts as string[] | undefined,
      };
    });
  } else {
    migrated.timers = [];
  }

  const timerMin = migrated.timers[0]?.durationMinutes || (migrated as Phase & { timeMinutes?: number }).timeMinutes || 10;
  const bufferMin = typeof migrated.bufferDurationMinutes === 'number' ? migrated.bufferDurationMinutes : 0;
  migrated.bufferDurationMinutes = bufferMin;
  migrated.targetDurationMinutes = timerMin + bufferMin;
  
  return migrated as Phase;
}

/**
 * Single-responsibility validator that normalizes a single Sound configuration.
 */
export function normalizeSound(sound: unknown): SoundConfig {
  const rawSound = { ...(sound as Record<string, unknown>) } as Partial<SoundConfig>;
  
  if (!rawSound.id) rawSound.id = createFallbackId();
  if (!rawSound.name) rawSound.name = 'Unnamed Sound';
  if (!rawSound.url) rawSound.url = '';

  return {
    ...rawSound,
    id: rawSound.id,
    name: rawSound.name,
    url: rawSound.url,
    type: rawSound.type || SoundType.BGM,
    volume: typeof rawSound.volume === 'number' ? rawSound.volume : 1.0,
    fadeInEnabled: !!rawSound.fadeInEnabled,
    fadeInDuration: typeof rawSound.fadeInDuration === 'number' ? rawSound.fadeInDuration : 3.0,
    fadeOutEnabled: !!rawSound.fadeOutEnabled,
    fadeOutDuration: typeof rawSound.fadeOutDuration === 'number' ? rawSound.fadeOutDuration : 3.0,
    loopEnabled: !!rawSound.loopEnabled,
    loopStart: typeof rawSound.loopStart === 'number' ? rawSound.loopStart : 0,
    loopEnd: typeof rawSound.loopEnd === 'number' ? rawSound.loopEnd : 0,
    startTime: typeof rawSound.startTime === 'number' ? rawSound.startTime : 0,
    endTime: typeof rawSound.endTime === 'number' ? rawSound.endTime : 0,
    chokeGroup: rawSound.chokeGroup || undefined,
  } as SoundConfig;
}

/**
 * Single-responsibility validator that normalizes a single Character entry.
 */
export function normalizeCharacter(char: unknown): Character {
  const rawChar = { ...(char as Record<string, unknown>) } as Partial<Character>;
  
  if (!rawChar.id) rawChar.id = createFallbackId();
  if (!rawChar.name) rawChar.name = 'Unnamed Character';

  return {
    ...rawChar,
    id: rawChar.id,
    name: rawChar.name,
    role: rawChar.role || CharacterType.PC,
    tokens: typeof rawChar.tokens === 'number' ? rawChar.tokens : 0,
    flags: Array.isArray(rawChar.flags) ? rawChar.flags : [],
    comment: rawChar.comment || '',
  } as Character;
}

/**
 * Validates, migrates, and repairs a full Scenario object.
 * Acts as a pipeline that composes individual specialized normalizer functions.
 * Adheres to ACID Consistency: prevents broken objects from propagating or being persisted.
 */
export function validateAndMigrateScenario(data: unknown): Scenario {
  const scenario = { ...(data as Record<string, unknown>) } as Partial<Scenario>;

  // 1. Core Base Attributes Check
  if (!scenario.id) scenario.id = createFallbackId();
  if (!scenario.title) scenario.title = 'Untitled Scenario';

  // 2. Gather migration flags
  let timerMigrated = false;
  let lapNotificationMigrated = false;
  let oldLapText = '';

  // Extract old lapNotificationText from any timers before normalization
  if (Array.isArray(scenario.phases)) {
    for (const p of scenario.phases) {
      if (p && Array.isArray(p.timers)) {
        for (const t of p.timers) {
          if (t && t.lapNotificationText) {
            oldLapText = t.lapNotificationText;
            break;
          }
        }
      }
      if (oldLapText) break;
    }
  }

  // 3. Map structures cleanly using modular parsers
  scenario.phases = Array.isArray(scenario.phases)
    ? scenario.phases.map(p => {
        const normalized = normalizePhase(p);
        if ((normalized as Phase & { _timerMigrated?: boolean })._timerMigrated) {
          timerMigrated = true;
        }
        return normalized;
      })
    : [];

  scenario.sounds = Array.isArray(scenario.sounds)
    ? scenario.sounds.map(normalizeSound)
    : [];

  scenario.characters = Array.isArray(scenario.characters)
    ? scenario.characters.map(normalizeCharacter)
    : [];

  scenario.playerImages = Array.isArray(scenario.playerImages)
    ? scenario.playerImages
    : [];

  // 4. Handle lap notification migration to syncConfig
  if (oldLapText) {
    const rawSyncConfig = scenario.syncConfig as Partial<SyncConfig> | undefined;
    if (!rawSyncConfig) {
      scenario.syncConfig = {
        timerEnabled: true,
        contentEnabled: true,
        timerSize: 'medium',
        timerPosition: 'top',
        imageFit: 'contain',
        activeImageId: null,
        lapDisplayMode: 'overlay', // Automatically set to overlay
        lapNotificationText: oldLapText,
      };
      lapNotificationMigrated = true;
    } else if (!rawSyncConfig.lapNotificationText) {
      (rawSyncConfig as Record<string, unknown>).lapNotificationText = oldLapText;
      if (!rawSyncConfig.lapDisplayMode || rawSyncConfig.lapDisplayMode === 'hidden') {
        (rawSyncConfig as Record<string, unknown>).lapDisplayMode = 'overlay'; // Automatically set to overlay
      }
      lapNotificationMigrated = true;
    }
  }

  // 5. Annotate scenario with migration flags if any migration occurred
  if (timerMigrated || lapNotificationMigrated) {
    (scenario as Scenario & { 
      _migrated?: boolean; 
      _migrationDetails?: { 
        timerMigrated: boolean; 
        lapNotificationMigrated: boolean; 
      };
    })._migrated = true;
    (scenario as Scenario & { 
      _migrated?: boolean; 
      _migrationDetails?: { 
        timerMigrated: boolean; 
        lapNotificationMigrated: boolean; 
      };
    })._migrationDetails = {
      timerMigrated,
      lapNotificationMigrated
    };
  }

  return scenario as Scenario;
}
