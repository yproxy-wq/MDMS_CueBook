import { validateAndMigrateScenario } from '../utils/scenarioValidator';
import type { Scenario } from '../types';

export const SCENARIO_FILE_ACCEPT = ['.zip', '.cuebook', '.json', 'application/zip', 'application/x-zip-compressed', 'application/json'].join(',');

export const isScenarioArchive = (fileName: string, mimeType: string) => {
  const normalizedName = fileName.toLowerCase();
  const normalizedMimeType = mimeType.toLowerCase();
  return normalizedName.endsWith('.zip') || normalizedName.endsWith('.cuebook')
    || normalizedMimeType === 'application/zip'
    || normalizedMimeType === 'application/x-zip-compressed';
};

export const hasZipSignature = (bytes: Uint8Array) => bytes.length >= 4
  && bytes[0] === 0x50 && bytes[1] === 0x4b
  && ((bytes[2] === 0x03 && bytes[3] === 0x04)
    || (bytes[2] === 0x05 && bytes[3] === 0x06)
    || (bytes[2] === 0x07 && bytes[3] === 0x08));

/** Loads either direct JSON or the scenario JSON contained in a CueBook archive. */
export async function parseScenarioFile(file: File): Promise<Scenario> {
  const source = await file.arrayBuffer();
  const bytes = new Uint8Array(source);
  let content: string;
  if (hasZipSignature(bytes)) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(source);
    const jsonFile = Object.values(zip.files).find(item => !item.dir && String(item.name || '').toLowerCase().endsWith('.json'));
    if (!jsonFile) throw new Error('ZIP内にシナリオJSONがありません。');
    content = await jsonFile.async('string');
  } else {
    // Backward compatibility: older CueBook versions may contain plain JSON.
    content = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  }
  return validateAndMigrateScenario(JSON.parse(content));
}
