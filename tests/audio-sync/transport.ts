import type { SoundConfig } from '../../src/types';
export { mergeSounds, portableSounds } from '../../src/services/AudioLibraryService';
export function subscribeAudioLibrary(uid: string, id: string, receive: (sounds: SoundConfig[] | null) => void, fail: (error: unknown) => void) {
  const events = new EventSource(`/audio-e2e/events?key=${encodeURIComponent(`${uid}/${id}`)}`);
  events.onmessage = event => receive(JSON.parse(event.data));
  events.onerror = () => fail(new Error('E2E通信切断'));
  return () => events.close();
}
export async function saveAudioLibrary(uid: string, id: string, base: SoundConfig[], local: SoundConfig[]): Promise<SoundConfig[]> {
  const response = await fetch('/audio-e2e/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: `${uid}/${id}`, base, local }) });
  if (!response.ok) throw new Error('E2E保存失敗');
  return response.json();
}
