import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useSessionRecovery } from '../../src/hooks/useSessionRecovery';
import { sessionRecoveryService, recoveryCleanKey } from '../../src/services/sessionRecoveryService';
import { RecoveryPresence } from '../../src/services/recoveryPresence';
import { INITIAL_SCENARIO } from '../../src/constants';
import type { AppState } from '../../src/types';
const scenarioId = 'isolated-recovery-e2e';
const scope = 'isolated-account';
const state: AppState = { currentScenario: { ...INITIAL_SCENARIO, id: scenarioId, title: '隔離復元E2E',
  sounds: [{ ...INITIAL_SCENARIO.sounds[0], id: 'r2-test', name: 'R2 fixture', url: 'r2://isolated-fixture' }] },
  currentPhaseId: 'phase', previewPhaseId: 'phase', isPlaying: {}, volume: .4, isDucking: false,
  timerStates: { clock: { seconds: 120, isRunning: true, startTime: 1234567890 } },
  isEditorMode: true, phaseResults: {}, phaseDurations: {}, usedSounds: new Set(['r2-test']) };
export function Session({ account }: { account: string }) {
  const [current, setCurrent] = useState<AppState>({ ...state, currentScenario: { ...state.currentScenario, sounds: [] },
    usedSounds: new Set(), timerStates: { clock: { seconds: 300, isRunning: false, startTime: null } } });
  const recovery = useSessionRecovery(true, current, account);
  return <section>
    <p>稼働中: {account}</p>
    <p>復元モーダル: {recovery.showRecoveryModal ? '表示' : 'なし'}</p>
    <p>候補: {recovery.backupData?.owner || 'なし'}</p>
    <p>旧候補: {recovery.legacyAvailable ? '任意確認' : 'なし'}</p>
    <p role="status">{recovery.recoveryError}</p>
    {recovery.backupData && <>
      <p>保存世代: {recovery.backupData.generation}</p>
      <button onClick={() => recovery.complete(setCurrent)}>復元</button>
      <button onClick={() => recovery.complete()}>候補を破棄</button>
      <button onClick={recovery.dismiss}>保持して続ける</button>
    </>}
    {recovery.legacyAvailable && <button onClick={recovery.inspectLegacy}>旧データを確認</button>}
    <output>{JSON.stringify({ timers: current.timerStates, sounds: current.currentScenario.sounds, usedSounds: [...current.usedSounds] })}</output>
  </section>;
}
export function Harness() {
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState(scope);
  const [message, setMessage] = useState('');
  const [live, setLive] = useState<RecoveryPresence | null>(null);
  const seed = async (owner: string) => {
    localStorage.removeItem(recoveryCleanKey(owner));
    await sessionRecoveryService.saveOwnedBackup(state, scope, owner);
    setMessage('保存済み: ' + owner);
  };
  const cas = async () => {
    await seed('cas-fixture');
    const old = (await sessionRecoveryService.listOwnedBackups(scope, scenarioId)).find(b => b.owner === 'cas-fixture')!;
    await seed('cas-fixture');
    const removed = await sessionRecoveryService.consumeBackup(old);
    const newer = (await sessionRecoveryService.listOwnedBackups(scope, scenarioId)).find(b => b.owner === 'cas-fixture')!;
    const isolated = await sessionRecoveryService.listOwnedBackups('other-account', scenarioId);
    const wrongScenario = await sessionRecoveryService.listOwnedBackups(scope, 'other-scenario');
    const retained = newer && newer.generation !== old.generation;
    await sessionRecoveryService.consumeBackup(newer);
    setMessage(`CAS: oldDeleted=${removed}; newerRetained=${Boolean(retained)}; accountLeak=${isolated.length}; scenarioLeak=${wrongScenario.length}`);
  };
  const resetFixtures = async () => {
    live?.close(); setLive(null);
    for (const accountScope of [scope, 'other-account']) {
      for (const backup of await sessionRecoveryService.listOwnedBackups(accountScope, scenarioId)) {
        await sessionRecoveryService.consumeBackup(backup);
      }
    }
    setMessage('隔離した復元候補を初期化しました');
  };
  return <main style={{ background: '#101012', color: '#eee', fontFamily: 'sans-serif', padding: 24, minHeight: '100vh' }}>
    <h1>隔離したSession Recovery E2E</h1>
    <p>このローカルポートの専用データだけを使用します。本番へ接続しません。</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={() => setMounted(!mounted)}>{mounted ? 'セッションを中断' : 'セッションを起動'}</button>
      <button onClick={() => seed('crashed-fixture')}>異常終了候補を作成</button>
      <button onClick={async () => { const owner = new RecoveryPresence('live-fixture'); setLive(owner); await seed('live-fixture'); }}>生存候補を作成</button>
      <button onClick={() => { live?.close(); setLive(null); setMessage('生存ロックを解放（異常終了の代替）'); }}>生存ロックを解放</button>
      <button onClick={cas}>世代競合・範囲分離を検証</button>
      <button onClick={() => setAccount(account === scope ? 'other-account' : scope)}>アカウント切替</button>
      <button disabled={mounted} onClick={resetFixtures}>隔離データを初期化</button>
    </div>
    <p role="status">{message}</p>
    {mounted && <Session account={account} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
