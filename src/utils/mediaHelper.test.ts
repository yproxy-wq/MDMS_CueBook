import { describe, expect, it } from 'vitest';
import { ImageResource } from '../types';
import { selectSyncMedia } from './mediaHelper';

const playerMedia: ImageResource[] = [
  { id: 'player-1', name: 'Player One', url: 'https://example.test/player-1', updatedAt: 1 },
  { id: 'player-2', name: 'Player Two', url: 'https://example.test/player-2', updatedAt: 1 },
];
const fallbackMedia: ImageResource[] = [
  { id: 'scenario-1', name: 'Scenario One', url: 'https://example.test/scenario-1', updatedAt: 1 },
];

describe('selectSyncMedia', () => {
  it('uses the player-shared order shown by Sync Studio', () => {
    expect(selectSyncMedia(playerMedia, fallbackMedia)).toBe(playerMedia);
  });

  it('falls back when no player-shared media exists', () => {
    expect(selectSyncMedia([], fallbackMedia)).toBe(fallbackMedia);
    expect(selectSyncMedia(undefined, fallbackMedia)).toBe(fallbackMedia);
  });
});
