import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { User } from 'firebase/auth';
import type { AppState } from '../../src/types';
import type { AudioLibrarySyncStatus } from '../../src/services/AudioLibrarySession';
import { INITIAL_SCENARIO } from '../../src/constants';
import { SoundTab } from '../../src/components/editor/SoundTab';
import { useAudioLibrarySync } from '../../src/hooks/useAudioLibrarySync';
import '../../src/index.css';
export function Fixture() {
  const [state, setState] = useState({ currentScenario: { ...INITIAL_SCENARIO, id: 'audio-e2e', sounds: [] } } as unknown as AppState);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<AudioLibrarySyncStatus>('loading');
  const [user] = useState({ uid: 'e2e-owner', getIdTokenResult: async () => ({ claims: { cuebookPlan: 'biz' } }) } as unknown as User);
  return <main className="min-h-screen bg-black p-8 text-white">
    <h1>CueBook 音源同期E2E（テスト用通信）</h1>
    <p role="alert">{error}</p>
    <Sync {...{ user, state, setState, setError, setStatus }} />
    <SoundTab syncStatus={status} scenario={state.currentScenario} onUpdate={scenario => setState(previous => ({ ...previous, currentScenario: scenario }))} previewingSoundId={null} onTogglePreview={() => {}} />
    <output aria-label="同期音源データ">{JSON.stringify(state.currentScenario.sounds)}</output>
  </main>;
}
export function Sync({ user, state, setState, setError, setStatus }: { user: User; state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; setError: (message: string) => void; setStatus: (status: AudioLibrarySyncStatus) => void }) {
  const status = useAudioLibrarySync(user, true, state, setState, setError);
  React.useEffect(() => setStatus(status), [status, setStatus]);
  return null;
}
createRoot(document.getElementById('root')!).render(<Fixture />);

