import { describe, it, expect } from 'vitest';
import { limitSnapshots, addSmartSnapshot, isDeepEqual, getScenarioDiff, reconstructScenario } from './snapshotHelper';
import { ScenarioSnapshot, Scenario } from '../types';

describe('snapshotHelper - limitSnapshots', () => {
  const createMockSnapshot = (id: string, label?: string): ScenarioSnapshot => ({
    id,
    label: label || `Snapshot ${id}`,
    timestamp: Date.now(),
    scenarioData: {} as unknown as Scenario
  });

  it('should append a new snapshot when size is under the limit', () => {
    const snapshots: ScenarioSnapshot[] = [
      createMockSnapshot('1'),
      createMockSnapshot('2')
    ];
    const newSnapshot = createMockSnapshot('3');
    const result = limitSnapshots(snapshots, newSnapshot, 10);

    expect(result.length).toBe(3);
    expect(result[result.length - 1].id).toBe('3');
  });

  it('should limit the snapshots to a maximum of 10 (FIFO)', () => {
    const snapshots: ScenarioSnapshot[] = Array.from({ length: 10 }, (_, i) => 
      createMockSnapshot((i + 1).toString())
    );
    const newSnapshot = createMockSnapshot('11');
    const result = limitSnapshots(snapshots, newSnapshot, 10);

    expect(result.length).toBe(10);
    expect(result[0].id).toBe('2');
    expect(result[result.length - 1].id).toBe('11');
  });
});

describe('snapshotHelper - addSmartSnapshot', () => {
  const createMockSnapshot = (id: string, label: string): ScenarioSnapshot => ({
    id,
    label,
    timestamp: Date.now(),
    scenarioData: {} as unknown as Scenario
  });

  it('should separate manual and automatic limits correctly', () => {
    // 10 Manuals and 5 Auto Saves
    let snapshots: ScenarioSnapshot[] = [];

    // Fill manuals up to limit (10)
    for (let i = 1; i <= 10; i++) {
      snapshots = addSmartSnapshot(snapshots, createMockSnapshot(`manual-${i}`, `Manual checkpoint ${i}`));
    }
    expect(snapshots.filter(s => !s.label.startsWith('[自動')).length).toBe(10);

    // Fill autos up to limit (5)
    for (let i = 1; i <= 5; i++) {
      snapshots = addSmartSnapshot(snapshots, createMockSnapshot(`auto-${i}`, `[自動保存] ${i}`));
    }
    expect(snapshots.filter(s => s.label.startsWith('[自動')).length).toBe(5);
    expect(snapshots.length).toBe(15);

    // Add another manual (should discard manual-1)
    snapshots = addSmartSnapshot(snapshots, createMockSnapshot('manual-11', 'Manual checkpoint 11'));
    const manuals = snapshots.filter(s => !s.label.startsWith('[自動'));
    expect(manuals.length).toBe(10);
    expect(manuals[0].id).toBe('manual-2');
    expect(manuals[manuals.length - 1].id).toBe('manual-11');

    // Add another automatic (should discard auto-1)
    snapshots = addSmartSnapshot(snapshots, createMockSnapshot('auto-6', '[自動保存] 6'));
    const autos = snapshots.filter(s => s.label.startsWith('[自動'));
    expect(autos.length).toBe(5);
    expect(autos[0].id).toBe('auto-2');
    expect(autos[autos.length - 1].id).toBe('auto-6');
  });

  it('should keep the order of insertion intact', () => {
    const s1 = createMockSnapshot('m1', 'Checkpoint 1');
    const s2 = createMockSnapshot('a1', '[自動] Backup 1');
    const s3 = createMockSnapshot('m2', 'Checkpoint 2');

    let list: ScenarioSnapshot[] = [];
    list = addSmartSnapshot(list, s1);
    list = addSmartSnapshot(list, s2);
    list = addSmartSnapshot(list, s3);

    expect(list[0].id).toBe('m1');
    expect(list[1].id).toBe('a1');
    expect(list[2].id).toBe('m2');
  });

  describe('isDeepEqual', () => {
    it('should correctly compare primitive values', () => {
      expect(isDeepEqual(1, 1)).toBe(true);
      expect(isDeepEqual('test', 'test')).toBe(true);
      expect(isDeepEqual(true, true)).toBe(true);
      expect(isDeepEqual(null, null)).toBe(true);
      expect(isDeepEqual(undefined, undefined)).toBe(true);
      expect(isDeepEqual(1, 2)).toBe(false);
      expect(isDeepEqual('test', 'best')).toBe(false);
      expect(isDeepEqual(true, false)).toBe(false);
      expect(isDeepEqual(null, undefined)).toBe(false);
    });

    it('should correctly compare arrays', () => {
      expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(isDeepEqual([1, 2, 3], [1, 2])).toBe(false);
      expect(isDeepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(isDeepEqual([[1], [2]], [[1], [2]])).toBe(true);
    });

    it('should correctly compare objects deeply', () => {
      const objA = { a: 1, b: { c: 'hello', d: [true] } };
      const objB = { a: 1, b: { c: 'hello', d: [true] } };
      const objC = { a: 1, b: { c: 'hello', d: [false] } };
      const objD = { a: 1, b: { c: 'world', d: [true] } };

      expect(isDeepEqual(objA, objB)).toBe(true);
      expect(isDeepEqual(objA, objC)).toBe(false);
      expect(isDeepEqual(objA, objD)).toBe(false);
    });
  });

  describe('Differential Save & Reconstruction', () => {
    it('should extract only modified keys compared to the baseline template', () => {
      const modifiedBlank: Scenario = {
        id: 'cuebook-blank',
        title: 'Updated title',
        author: 'Updated author',
        themeColor: '#121212', // Unchanged default
        subThemeColor: '#333333', // Unchanged default
        checklistPosition: 'bottom',
        masterVolumePosition: 'top',
        columnLayoutMode: 'auto',
        uiScaleMode: 'medium',
        popupTimerPosition: 'top-right',
        backgroundImage: '',
        phases: [], // Changed (baseline has default phases)
        sounds: [], // Changed (baseline has blizzard-gust bgm)
        characters: [], // Changed
        images: []
      };

      const diff = getScenarioDiff(modifiedBlank);
      expect(diff.id).toBe('cuebook-blank');
      expect(diff.title).toBe('Updated title');
      expect(diff.author).toBe('Updated author');
      expect(diff.themeColor).toBeUndefined(); // Should be dropped since it matches baseline
      expect(diff.subThemeColor).toBeUndefined(); // Should be dropped since it matches baseline
      expect(diff.phases).toEqual([]); // Stored since it was changed
    });

    it('should fully reconstruct the original scenario when combining baseline + diff', () => {
      const original: Scenario = {
        id: 'cuebook-blank',
        title: 'Championship Trial',
        author: 'Host G',
        themeColor: '#ff0000',
        subThemeColor: '#220000',
        checklistPosition: 'bottom',
        masterVolumePosition: 'top',
        columnLayoutMode: 'auto',
        uiScaleMode: 'medium',
        popupTimerPosition: 'top-right',
        backgroundImage: 'crimson.png',
        phases: [{ id: 'p1', name: 'Phase Alpha', description: '', script: '', recommendedSounds: [], scriptBlocks: [], checklists: [], timers: [], targetDurationMinutes: 10 }],
        sounds: [],
        characters: [],
        images: []
      };

      const diff = getScenarioDiff(original);
      const reconstructed = reconstructScenario(diff);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.title).toBe(original.title);
      expect(reconstructed.author).toBe(original.author);
      expect(reconstructed.themeColor).toBe(original.themeColor);
      expect(reconstructed.backgroundImage).toBe(original.backgroundImage);
      expect(reconstructed.phases[0].name).toBe('Phase Alpha');
      expect(reconstructed.snapshots).toBeUndefined(); // Always verified
    });

    it('should prune recursive snapshots to break exponential JSON nesting', () => {
      // Mock scenario that has nested snapshots
      const mockScenario: Scenario = {
        id: 'cuebook-blank',
        title: 'Title',
        author: 'Author',
        themeColor: '#121212',
        subThemeColor: '#333333',
        checklistPosition: 'bottom',
        masterVolumePosition: 'top',
        columnLayoutMode: 'auto',
        uiScaleMode: 'medium',
        popupTimerPosition: 'top-right',
        backgroundImage: '',
        phases: [],
        sounds: [],
        characters: [],
        images: [],
        snapshots: [
          { id: 'snap-nested', label: 'Nested', timestamp: Date.now(), scenarioData: {} as Scenario }
        ]
      };

      const newSnapshot: ScenarioSnapshot = {
        id: 'snap-root',
        label: 'Root Snapshot',
        timestamp: Date.now(),
        scenarioData: mockScenario
      };

      const result = addSmartSnapshot([], newSnapshot);
      const processedScenarioData = result[0].scenarioData;

      expect(processedScenarioData.snapshots).toBeUndefined(); // Ensure snapshots field was fully pruned
    });
  });
});
