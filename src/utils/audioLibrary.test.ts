import { describe, expect, it } from 'vitest';
import { mergeSounds, portableSounds } from './audioLibrary';
import { SoundType, type SoundConfig } from '../types';
const song = (id: string): SoundConfig => ({ id, name: id, type: SoundType.BGM, url: '' });
describe('audio three-way merge', () => {
  it('preserves concurrent additions and remote edits while applying local deletions', () => {
    expect(mergeSounds([song('a'), song('b')], [song('a'), song('c')], [{ ...song('a'), volume: .3 }, song('b'), song('d')]))
      .toEqual([{ ...song('a'), volume: .3 }, song('c'), song('d')]);
  });
  it('does not resurrect a remotely deleted sound from a stale edit', () => {
    expect(mergeSounds([song('a')], [{ ...song('a'), name: 'edit' }], [])).toEqual([]);
  });
  it('preserves remote order unless this device reordered sounds', () => {
    expect(mergeSounds([song('a'), song('b')], [song('a'), song('b')], [song('b'), song('a')]).map(s => s.id)).toEqual(['b', 'a']);
    expect(mergeSounds([song('a'), song('b')], [song('b'), song('a')], [song('a'), song('b'), song('c')]).map(s => s.id)).toEqual(['b', 'a', 'c']);
  });
  it('removes undefined fields and device-only URLs while keeping R2 IDs', () => {
    const cloud = portableSounds([{ ...song('a'), url: 'blob:local', volume: undefined }, { ...song('b'), url: 'r2://asset', storageProvider: 'r2', storageAssetId: 'asset' }]);
    expect(cloud[0].url).toBe(''); expect(cloud[0]).not.toHaveProperty('volume'); expect(cloud[1].url).toBe('r2://asset');
  });
});
