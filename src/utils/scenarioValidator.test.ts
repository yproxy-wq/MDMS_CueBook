import { describe, it, expect } from 'vitest';
import {
  migratePhaseScript,
  normalizePhase,
  normalizeSound,
  normalizeCharacter,
  validateAndMigrateScenario
} from './scenarioValidator';
import { SoundType, CharacterType } from '../types';

describe('scenarioValidator / ACID & UNIX Refactoring Suite', () => {
  describe('migratePhaseScript', () => {
    it('should migrate script string to scriptBlocks cleanly', () => {
      const dummyPhase = {
        title: 'Miyako Phase',
        script: '# Miyako script test'
      };
      const migrated = migratePhaseScript(dummyPhase);
      expect(migrated.scriptBlocks).toBeDefined();
      expect(migrated.scriptBlocks!.length).toBe(1);
      expect(migrated.scriptBlocks![0].content).toBe('# Miyako script test');
      expect(migrated.scriptBlocks![0].type).toBe('markdown');
    });

    it('should keep existing scriptBlocks if present', () => {
      const dummyPhase = {
        title: 'Miyako Phase 2',
        script: 'Old raw script',
        scriptBlocks: [
          { id: 'block-1', type: 'markdown' as const, content: 'Kept script' }
        ]
      };
      const migrated = migratePhaseScript(dummyPhase);
      expect(migrated.scriptBlocks!.length).toBe(1);
      expect(migrated.scriptBlocks![0].content).toBe('Kept script');
    });
  });

  describe('normalizePhase', () => {
    it('should generate an auto-id and default title if missing', () => {
      const raw = {};
      const normalized = normalizePhase(raw);
      expect(normalized.id).toBeDefined();
      expect(normalized.title).toBe('Untitled Phase');
      expect(normalized.timers).toEqual([]);
    });
  });

  describe('normalizeSound', () => {
    it('should normalize and fill missing sound items safely', () => {
      const raw = {
        name: 'Ambient Rain',
        url: 'https://rain.mp3',
        volume: 0.5
      };
      const normalized = normalizeSound(raw);
      expect(normalized.id).toBeDefined();
      expect(normalized.name).toBe('Ambient Rain');
      expect(normalized.url).toBe('https://rain.mp3');
      expect(normalized.volume).toBe(0.5);
      expect(normalized.type).toBe(SoundType.BGM);
      expect(normalized.fadeInDuration).toBe(3.0);
    });
  });

  describe('normalizeCharacter', () => {
    it('should default Character entries cleanly', () => {
      const raw = {
        name: 'Miyako Kujo'
      };
      const normalized = normalizeCharacter(raw);
      expect(normalized.id).toBeDefined();
      expect(normalized.name).toBe('Miyako Kujo');
      expect(normalized.role).toBe(CharacterType.PC);
      expect(normalized.tokens).toBe(0);
      expect(normalized.flags).toEqual([]);
    });
  });

  describe('validateAndMigrateScenario', () => {
    it('should process full nested object with high integrity', () => {
      const dirtyScenario = {
        title: 'Gothic Mystery Scenario',
        phases: [
          { title: 'The Prologue', script: 'Welcome to this gothic trial.' }
        ],
        sounds: [
          { name: 'Ominous bell', url: 'bell.ogg', type: SoundType.SE }
        ],
        characters: [
          { name: 'Dr. John', role: CharacterType.NPC }
        ]
      };

      const normalized = validateAndMigrateScenario(dirtyScenario);

      // Verify global metadata
      expect(normalized.id).toBeDefined();
      expect(normalized.title).toBe('Gothic Mystery Scenario');

      // Verify nested phases consistency
      expect(normalized.phases[0].title).toBe('The Prologue');
      expect(normalized.phases[0].scriptBlocks![0].content).toBe('Welcome to this gothic trial.');

      // Verify sounds consistency
      expect(normalized.sounds[0].name).toBe('Ominous bell');
      expect(normalized.sounds[0].type).toBe(SoundType.SE);

      // Verify characters consistency
      expect(normalized.characters[0].name).toBe('Dr. John');
      expect(normalized.characters[0].role).toBe(CharacterType.NPC);
    });
  });
});
