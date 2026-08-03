import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from './constants';
import { APP_VERSION } from './config/version';

describe('initial scenario release information', () => {
  it('labels the current update guide with the application release version for new and reset scenarios', () => {
    const updatePhase = INITIAL_SCENARIO.phases.find((phase) => phase.id === 't-08-updates');

    expect(updatePhase?.name).toBe(`09. 更新情報 (${APP_VERSION})`);
    expect(updatePhase?.scriptBlocks?.[0]?.content).toContain(`更新ログ (${APP_VERSION})`);
  });
});
