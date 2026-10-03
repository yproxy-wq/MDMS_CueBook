import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { AppState } from '../types';
import { portableSounds, saveAudioLibrary, subscribeAudioLibrary } from '../services/AudioLibraryService';
import { createAudioLibrarySession, type AudioLibrarySyncStatus } from '../services/AudioLibrarySession';

export function useAudioLibrarySync(user: User | null, isReady: boolean, state: AppState, setState: Dispatch<SetStateAction<AppState>>, onError: (message: string) => void, onRemoved?: (soundId: string) => void) {
  const latest = useRef({ sounds: state.currentScenario.sounds || [], onError, onRemoved });
  useEffect(() => { latest.current = { sounds: state.currentScenario.sounds || [], onError, onRemoved }; }, [state.currentScenario.sounds, onError, onRemoved]);
  const session = useRef<ReturnType<typeof createAudioLibrarySession> | null>(null);
  const scenarioId = state.currentScenario.id;
  const statusKey = `${user?.uid || ''}:${scenarioId}`;
  const [syncStatus, setSyncStatus] = useState<{ key: string; status: AudioLibrarySyncStatus }>({ key: '', status: 'local' });
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (import.meta.env.VITE_CUEBOOK_TENANT !== 'xtv' || !isReady || !user) return;
    let active = true;
    const publishStatus = (status: AudioLibrarySyncStatus) => {
      if (active) setSyncStatus(previous => previous.key === statusKey && previous.status === status ? previous : { key: statusKey, status });
    };
    const fail = (error: unknown) => {
      publishStatus('unavailable');
      if (active) latest.current.onError(error instanceof Error ? error.message : '音源一覧を同期できません。接続を確認してください。');
    };
    void user.getIdTokenResult().then(token => {
      if (!active) return;
      if (token.claims.cuebookPlan !== 'biz') { publishStatus('local'); return; }
      session.current = createAudioLibrarySession({
        initial: latest.current.sounds,
        pendingKey: `cuebook_audio_pending_${user.uid}_${scenarioId}`,
        subscribe: (receive, error) => subscribeAudioLibrary(user.uid, scenarioId, receive, error),
        save: (base, local) => saveAudioLibrary(user.uid, scenarioId, base, local),
        fail,
        onStatus: publishStatus,
        apply: sounds => {
          const ids = new Set(sounds.map(sound => sound.id));
          for (const old of latest.current.sounds) if (!ids.has(old.id)) latest.current.onRemoved?.(old.id);
          setState(previous => {
            if (previous.currentScenario.id !== scenarioId || JSON.stringify(portableSounds(previous.currentScenario.sounds || [])) === JSON.stringify(sounds)) return previous;
            const existing = new Map((previous.currentScenario.sounds || []).map(sound => [sound.id, sound]));
            return { ...previous, currentScenario: { ...previous.currentScenario, sounds: sounds.map(sound => {
              const old = existing.get(sound.id);
              return !sound.url && old && /^(blob:|data:)/i.test(old.url) ? { ...sound, url: old.url } : sound;
            }) } };
          });
        },
      });
    }).catch(fail);
    return () => { active = false; session.current?.dispose(); session.current = null; };
  }, [user, isReady, scenarioId, setState, statusKey]);
  useEffect(() => { session.current?.edit(state.currentScenario.sounds || []); }, [state.currentScenario.sounds]);
  if (import.meta.env.VITE_CUEBOOK_TENANT !== 'xtv' || !isReady || !user) return 'local' as const;
  const status = syncStatus.key === statusKey ? syncStatus.status : 'loading' as const;
  return !online && status !== 'local' ? 'offline' as const : status;
}
