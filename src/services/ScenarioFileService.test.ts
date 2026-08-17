import { describe, expect, it } from 'vitest';
import { isScenarioArchive } from './ScenarioFileService';

describe('isScenarioArchive', () => {
  it('recognizes CueBook and ZIP scenario containers without treating JSON as an archive', () => {
    expect(isScenarioArchive('scenario.cuebook', '')).toBe(true);
    expect(isScenarioArchive('scenario.ZIP', '')).toBe(true);
    expect(isScenarioArchive('untitled', 'application/zip')).toBe(true);
    expect(isScenarioArchive('scenario.json', 'application/json')).toBe(false);
  });
});
