import type { SoundConfig } from '../types';

export function portableSounds(sounds: SoundConfig[]): SoundConfig[] {
  return sounds.map(sound => JSON.parse(JSON.stringify({ ...sound,
    url: /^(blob:|data:)/i.test(sound.url) ? '' : sound.url,
  })) as SoundConfig);
}

/** Apply only this device's edits, preserving independent edits on another device. */
export function mergeSounds(base: SoundConfig[], local: SoundConfig[], remote: SoundConfig[]): SoundConfig[] {
  const result = new Map(remote.map(sound => [sound.id, { ...sound }]));
  const originals = new Map(base.map(sound => [sound.id, sound]));
  const localIds = new Set(local.map(sound => sound.id));
  for (const sound of base) if (!localIds.has(sound.id)) result.delete(sound.id);
  for (const sound of local) {
    const original = originals.get(sound.id);
    if (!original) { result.set(sound.id, sound); continue; }
    const target = result.get(sound.id);
    // A remote deletion wins over edits to an old copy.
    if (!target) continue;
    for (const key of new Set([...Object.keys(original), ...Object.keys(sound)])) {
      const field = key as keyof SoundConfig;
      if (JSON.stringify(original[field]) !== JSON.stringify(sound[field])) {
        if (sound[field] === undefined) delete target[field];
        else Object.assign(target, { [field]: sound[field] });
      }
    }
  }
  const reordered = base.map(s => s.id).join('\n') !== local.filter(s => originals.has(s.id)).map(s => s.id).join('\n');
  const order = reordered ? local : remote;
  return [...order.map(s => s.id), ...local.map(s => s.id), ...remote.map(s => s.id)]
    .filter((id, index, ids) => ids.indexOf(id) === index && result.has(id))
    .map(id => result.get(id)!);
}


