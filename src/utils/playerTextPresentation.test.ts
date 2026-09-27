import { describe, expect, it } from 'vitest';
import { Phase } from '../types';
import { getPlayerTextBlocks, selectPlayerTextBlocks } from './playerTextPresentation';

const phase = (overrides: Partial<Phase> = {}): Phase => ({
  id: 'phase-1',
  name: '導入',
  description: '',
  script: '',
  checklists: [],
  timers: [],
  recommendedSounds: [],
  ...overrides,
});

describe('player text presentation selection', () => {
  it('offers only text blocks and preserves their order', () => {
    const result = getPlayerTextBlocks(phase({
      scriptBlocks: [
        { id: 'image', type: 'image', content: 'image-id' },
        { id: 'first', type: 'markdown', content: 'First' },
        { id: 'pdf', type: 'pdf', content: 'pdf-id' },
        { id: 'second', type: 'outline', content: '# Second' },
      ],
    }));

    expect(result.map((block) => block.id)).toEqual(['first', 'second']);
  });

  it('uses the legacy script as one selectable text page', () => {
    const result = getPlayerTextBlocks(phase({ script: '昔の台本' }));
    expect(result).toEqual([{ id: 'legacy-script', type: 'markdown', content: '昔の台本', label: '導入' }]);
  });

  it('returns selected blocks without exposing unselected text', () => {
    const selected = selectPlayerTextBlocks(phase({
      scriptBlocks: [
        { id: 'first', type: 'markdown', content: 'First' },
        { id: 'second', type: 'markdown', content: 'Second' },
      ],
    }), new Set(['second']));

    expect(selected.map((block) => block.content)).toEqual(['Second']);
  });
});
