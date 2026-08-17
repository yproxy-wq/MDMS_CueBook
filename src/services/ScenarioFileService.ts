import { validateAndMigrateScenario } from '../utils/scenarioValidator';
import type { Scenario } from '../types';

export const isScenarioArchive = (fileName: string, mimeType: string) => {
  const normalizedName = fileName.toLowerCase();
  return normalizedName.endsWith('.zip') || normalizedName.endsWith('.cuebook') || mimeType === 'application/zip';
};

/** Loads either direct JSON or the scenario JSON contained in a CueBook archive. */
export async function parseScenarioFile(file: File): Promise<Scenario> {
  let content: string;
  if (isScenarioArchive(String(file.name || ''), file.type)) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(file);
    const jsonFile = Object.values(zip.files).find(item => String(item.name || '').toLowerCase().endsWith('.json'));
    if (!jsonFile) throw new Error('ZIP内にシナリオJSONがありません。');
    content = await jsonFile.async('string');
  } else {
    content = await file.text();
  }
  return validateAndMigrateScenario(JSON.parse(content));
}
