import { describe, expect, it } from 'vitest';
import {
  limitScenarioCatalogEntries,
  MAX_SCENARIO_ENTRIES,
} from '../utils/scenarioCatalog';
import type { ScenarioRegistryEntry } from './ScenarioRegistryService';

const entry = (scenarioId: string, title = scenarioId): ScenarioRegistryEntry => ({
  scenarioId,
  title,
  updatedAt: 0,
  availability: 'available',
  source: 'local',
});

describe('limitScenarioCatalogEntries', () => {
  it('keeps exactly the supported number of entries in deterministic title order', () => {
    const entries = Array.from({ length: MAX_SCENARIO_ENTRIES + 3 }, (_, index) =>
      entry(`scenario-${index}`, `Scenario ${String(MAX_SCENARIO_ENTRIES + 3 - index).padStart(2, '0')}`),
    );

    const result = limitScenarioCatalogEntries(entries);

    expect(result).toHaveLength(MAX_SCENARIO_ENTRIES);
    expect(result.map(item => item.title)).toEqual([...result.map(item => item.title)].sort());
  });

  it('deduplicates IDs and retains the active scenario when the catalog overflows', () => {
    const entries = [
      entry('duplicate', 'A duplicate old'),
      entry('duplicate', 'A duplicate current'),
      ...Array.from({ length: MAX_SCENARIO_ENTRIES + 2 }, (_, index) => entry(`scenario-${index}`, `A${index}`)),
      entry('active', 'Z active'),
    ];

    const result = limitScenarioCatalogEntries(entries, 'active');

    expect(result).toHaveLength(MAX_SCENARIO_ENTRIES);
    expect(result.filter(item => item.scenarioId === 'duplicate')).toHaveLength(1);
    expect(result.some(item => item.scenarioId === 'active')).toBe(true);
  });

  it('uses scenario ID as a stable tie-breaker for equal titles', () => {
    const result = limitScenarioCatalogEntries([
      entry('scenario-b', '同名'),
      entry('scenario-a', '同名'),
    ]);

    expect(result.map(item => item.scenarioId)).toEqual(['scenario-a', 'scenario-b']);
  });
});
