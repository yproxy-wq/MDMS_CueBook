import { describe, expect, it } from 'vitest';
import { hasZipSignature, isScenarioArchive, SCENARIO_FILE_ACCEPT } from './ScenarioFileService';

describe('isScenarioArchive', () => {
  it('recognizes CueBook and ZIP scenario containers without treating JSON as an archive', () => {
    expect(isScenarioArchive('scenario.cuebook', '')).toBe(true);
    expect(isScenarioArchive('scenario.ZIP', '')).toBe(true);
    expect(isScenarioArchive('untitled', 'application/zip')).toBe(true);
    expect(isScenarioArchive('untitled', 'application/x-zip-compressed')).toBe(true);
    expect(isScenarioArchive('scenario.json', 'application/json')).toBe(false);
  });

  it('recognizes ZIP content independently of mobile file names and MIME types', () => {
    expect(hasZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(hasZipSignature(new TextEncoder().encode('{}'))).toBe(false);
  });

  it('offers ZIP and backward-compatible import types to mobile pickers', () => {
    expect(SCENARIO_FILE_ACCEPT).toContain('.zip');
    expect(SCENARIO_FILE_ACCEPT).toContain('.cuebook');
    expect(SCENARIO_FILE_ACCEPT).toContain('application/zip');
  });
});
