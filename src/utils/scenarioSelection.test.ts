import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { resolveScenarioForSelection } from './scenarioSelection';

describe('resolveScenarioForSelection', () => {
  it('uses the bundled guide when its first IndexedDB autosave has not completed', () => {
    expect(resolveScenarioForSelection(INITIAL_SCENARIO.id, null)).toBe(INITIAL_SCENARIO);
  });

  it('preserves stored scenario content while repairing an outdated embedded id', () => {
    const stored = { ...INITIAL_SCENARIO, id: 'old-cloud-id', title: 'Saved guide edits' };
    const resolved = resolveScenarioForSelection(INITIAL_SCENARIO.id, stored);

    expect(resolved).toMatchObject({ id: INITIAL_SCENARIO.id, title: 'Saved guide edits' });
    expect(resolved?.phases).toBe(stored.phases);
  });

  it('does not invent an unavailable non-built-in scenario', () => {
    expect(resolveScenarioForSelection('missing-scenario', null)).toBeNull();
  });
});
