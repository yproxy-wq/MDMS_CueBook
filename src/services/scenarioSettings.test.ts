import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/firebase', () => ({ db: {} }));
import { applyScenarioSettings, type ScenarioSettings } from './ScenarioRegistryService';
import { INITIAL_SCENARIO } from '../constants';
describe('cloud scenario settings boundary', () => {
  it('cannot replace the selected scenario identity or contents with legacy cloud fields', () => {
    const settings = {id:'old-scenario',title:'Old title',phases:[],sounds:[],themeColor:'#123456'} as ScenarioSettings;
    const next = applyScenarioSettings(INITIAL_SCENARIO, settings);
    expect(next.id).toBe(INITIAL_SCENARIO.id);
    expect(next.title).toBe(INITIAL_SCENARIO.title);
    expect(next.phases).toBe(INITIAL_SCENARIO.phases);
    expect(next.sounds).toBe(INITIAL_SCENARIO.sounds);
    expect(next.themeColor).toBe('#123456');
  });
  it('does not erase local preferences with undefined cloud fields', () => {
    expect(applyScenarioSettings({...INITIAL_SCENARIO,themeColor:'#abcdef'}, {themeColor:undefined}).themeColor).toBe('#abcdef');
  });
});
