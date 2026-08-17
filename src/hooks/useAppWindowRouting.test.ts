import { describe, expect, it } from 'vitest';
import { getRequestedScenarioId } from './useAppWindowRouting';

describe('getRequestedScenarioId', () => {
  it('extracts only the scenario identifier from a URL search string', () => {
    expect(getRequestedScenarioId('?view=timer&scenarioId=scene-a')).toBe('scene-a');
    expect(getRequestedScenarioId('?view=timer')).toBeNull();
  });
});
