import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from '../types';
import { sessionRecoveryService, recoveryCleanKey, type RecoveryBackup } from '../services/sessionRecoveryService';
import { RecoveryPresence } from '../services/recoveryPresence';

export function useSessionRecovery(isReady: boolean, state: AppState, scope: string | null) {
  const [backupData, setBackupData] = useState<RecoveryBackup | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [legacyAvailable, setLegacyAvailable] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [busy, setBusy] = useState(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;
  const ownerRef = useRef('');
  if (!ownerRef.current) ownerRef.current = crypto.randomUUID();
  const owner = ownerRef.current;
  const presenceRef = useRef<RecoveryPresence | null>(null);
  const releaseClaimRef = useRef<(() => void) | null>(null);
  const scenarioId = state.currentScenario.id;
  const contextRef = useRef({ scope, scenarioId, revision: 0 });
  if (contextRef.current.scope !== scope || contextRef.current.scenarioId !== scenarioId) {
    contextRef.current = { scope, scenarioId, revision: contextRef.current.revision + 1 };
  }
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const actionRef = useRef(false);

  useEffect(() => {
    if (!scope) return;
    const presence = new RecoveryPresence(owner);
    presenceRef.current = presence;
    const mark = (clean: boolean) => {
      try {
        if (clean) localStorage.setItem(recoveryCleanKey(owner), 'true');
        else localStorage.removeItem(recoveryCleanKey(owner));
      } catch { /* Disabled storage must not block startup. */ }
    };
    const hide = (event: PageTransitionEvent) => { if (!event.persisted) mark(true); };
    const show = () => mark(false);
    mark(false);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      presence.close();
      if (presenceRef.current === presence) presenceRef.current = null;
    };
  }, [scope, owner]);

  useEffect(() => {
    if (!isReady || !scope) return;
    let cancelled = false;
    const presence = presenceRef.current;
    setBackupData(null);
    setShowRecoveryModal(false);
    setRecoveryError('');
    setBusy(false);
    setLegacyAvailable(false);
    releaseClaimRef.current?.();
    releaseClaimRef.current = null;
    void (async () => {
      try {
        const candidates = await sessionRecoveryService.listOwnedBackups(scope, scenarioId);
        for (const candidate of candidates) {
          if (cancelled) return;
          if (candidate.owner === owner) continue;
          let clean = false;
          try { clean = localStorage.getItem(recoveryCleanKey(candidate.owner)) === 'true'; } catch { /* unknown */ }
          if (clean) continue;
          const status = await presence?.status(candidate.owner) ?? 'unknown';
          if (cancelled) return;
          if (status === 'alive') continue;
          const release = await presence?.claim(candidate.key);
          if (cancelled) { release?.(); return; }
          if (!release) continue;
          releaseClaimRef.current = release;
          setBackupData(candidate);
          setShowRecoveryModal(status === 'absent');
          break;
        }
        // Legacy data has no account identity. Disclose no title until opt-in;
        // do not overwrite or delete it as part of the new save protocol.
        const legacy = await sessionRecoveryService.getBackup();
        if (!cancelled) setLegacyAvailable(Boolean(legacy && Number.isFinite(legacy.timestamp) &&
          legacy.timestamp <= Date.now() && Date.now() - legacy.timestamp < 345600000));
      } catch (error) {
        console.warn('[SessionRecovery] Backup lookup failed:', error);
        if (!cancelled) setRecoveryError('バックアップを確認できませんでした。保存データは保持しています。');
      }
    })();
    return () => {
      cancelled = true;
      releaseClaimRef.current?.();
      releaseClaimRef.current = null;
    };
  }, [isReady, scope, scenarioId, owner]);

  useEffect(() => {
    if (!isReady || !scope) return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const save = async () => {
      if (actionRef.current) {
        timeout = setTimeout(() => { void save(); }, 15000);
        return;
      }
      try { await sessionRecoveryService.saveOwnedBackup(latestStateRef.current, scope, owner); }
      catch (error) {
        console.warn('[SessionRecovery] Backup save failed:', error);
        if (!cancelled) setRecoveryError('バックアップを保存できませんでした。ストレージの空き容量を確認してください。');
      } finally { if (!cancelled) timeout = setTimeout(() => { void save(); }, 15000); }
    };
    timeout = setTimeout(() => { void save(); }, 5000);
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [isReady, scope, scenarioId, owner]);

  const dismiss = useCallback(() => {
    setShowRecoveryModal(false);
    setBackupData(null);
    setLegacyAvailable(false);
    setRecoveryError('');
    releaseClaimRef.current?.();
    releaseClaimRef.current = null;
  }, []);

  const complete = useCallback(async (restore?: (saved: AppState) => void) => {
    if (!backupData || actionRef.current || backupData.scope !== contextRef.current.scope || backupData.scenarioId !== contextRef.current.scenarioId) return;
    actionRef.current = true;
    const revision = contextRef.current.revision;
    const stillCurrent = () => mountedRef.current && contextRef.current.revision === revision;
    setBusy(true);
    try {
      // Persist destination before applying/deleting anything. Transaction
      // generation comparison prevents deleting a concurrent newer save.
      if (restore) {
        await sessionRecoveryService.saveOwnedBackup(backupData.state, scope, owner);
        if (!stillCurrent()) return;
        restore(backupData.state);
      }
      if (backupData.owner !== 'legacy') await sessionRecoveryService.consumeBackup(backupData);
      if (stillCurrent()) dismiss();
    } catch (error) {
      console.warn('[SessionRecovery] Recovery action failed:', error);
      if (stillCurrent()) setRecoveryError('処理を完了できませんでした。バックアップは保持しています。再試行してください。');
    } finally { actionRef.current = false; if (mountedRef.current) setBusy(false); }
  }, [backupData, scope, owner, dismiss]);

  const inspectLegacy = useCallback(async () => {
    const revision = contextRef.current.revision;
    let legacy: Awaited<ReturnType<typeof sessionRecoveryService.getBackup>>;
    try { legacy = await sessionRecoveryService.getBackup(); }
    catch {
      if (mountedRef.current && contextRef.current.revision === revision) {
        setRecoveryError('旧形式のバックアップを読み込めませんでした。データは保持しています。');
      }
      return;
    }
    if (!mountedRef.current || contextRef.current.revision !== revision) return;
    if (!scope || !legacy || legacy.state?.currentScenario?.id !== scenarioId || !Number.isFinite(legacy.timestamp) ||
      legacy.timestamp > Date.now() || Date.now() - legacy.timestamp >= 345600000) {
      setRecoveryError('旧形式のバックアップは現在のシナリオに一致しません。データは保持しています。');
      return;
    }
    setBackupData({ ...legacy, key: 'session_recovery_backup', generation: String(legacy.timestamp), scope, owner: 'legacy', scenarioId });
    setShowRecoveryModal(true);
    setLegacyAvailable(false);
  }, [scope, scenarioId]);

  return { backupData, showRecoveryModal, setShowRecoveryModal, legacyAvailable, inspectLegacy,
    recoveryError, busy, complete, dismiss };
}
