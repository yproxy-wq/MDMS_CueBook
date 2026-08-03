import { describe, expect, it } from 'vitest';
import { INITIAL_SCENARIO } from './constants';

describe('initial scenario release information', () => {
  it('labels the current update guide as v0.97 for new and reset scenarios', () => {
    const updatePhase = INITIAL_SCENARIO.phases.find((phase) => phase.id === 't-08-updates');

    expect(updatePhase?.name).toBe('09. 更新情報 (v0.97)');
    expect(updatePhase?.scriptBlocks?.[0]?.content).toContain('更新ログ (v0.97)');
  });
});
