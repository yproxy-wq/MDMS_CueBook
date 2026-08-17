import { describe, expect, it } from 'vitest';
import { BLANK_SCENARIO, INITIAL_SCENARIO } from '../constants';
import { createResetScenarioWithSnapshot } from './scenarioReset';

describe('createResetScenarioWithSnapshot', () => {
  it('preserves a recoverable snapshot while replacing the scenario with the reset target', () => {
    const reset = createResetScenarioWithSnapshot(INITIAL_SCENARIO, BLANK_SCENARIO, '[auto: before reset]', Date.UTC(2026, 7, 18, 1, 2));

    expect(reset.id).toBe(BLANK_SCENARIO.id);
    expect(reset.snapshots?.[0]).toMatchObject({
      scenarioData: expect.objectContaining({ id: INITIAL_SCENARIO.id }),
    });
    expect(reset.snapshots?.[0]?.label).toMatch(/^\[auto: before reset\] \d{2}:\d{2}$/);
  });
});
