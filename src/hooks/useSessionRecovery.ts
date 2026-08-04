import { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { sessionRecoveryService } from '../services/sessionRecoveryService';

interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

interface RequestIdleCallbackOptions {
  timeout?: number;
}

type RequestIdleCallbackHandle = number;

declare global {
  interface Window {
    requestIdleCallback(
      callback: (deadline: IdleDeadline) => void,
      options?: RequestIdleCallbackOptions
    ): RequestIdleCallbackHandle;
    cancelIdleCallback(handle: RequestIdleCallbackHandle): void;
  }
}

export function useSessionRecovery(isReady: boolean, state: AppState) {
  const [backupData, setBackupData] = useState<{ state: AppState; timestamp: number } | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const latestStateRef = useRef(state);
  latestStateRef.current = state;

  useEffect(() => {
    let active = true;
    const checkRecoveryOnStartup = async () => {
      if (!isReady) {
        const isClean = await sessionRecoveryService.isCleanExit();
        const backup = await sessionRecoveryService.getBackup();

        if (active && backup && !isClean) {
          // Verify backup state actually exists and is within last 96 hours (4 days)
          if (backup.state && Date.now() - backup.timestamp < 345600000) {
            setBackupData(backup);
            setShowRecoveryModal(true);
          }
        }
        
        // Mark session as not cleanly exited during active use
        if (active) {
          await sessionRecoveryService.saveCleanExit(false);
        }
      }
    };

    checkRecoveryOnStartup();
    return () => {
      active = false;
    };
  }, [isReady]);

  // Periodic Auto-save logic (runs independently from React state identity changes)
  useEffect(() => {
    if (!isReady) return;

    let cancelled = false;
    let timeoutId: number | undefined;
    let idleCallbackId: RequestIdleCallbackHandle | undefined;

    const scheduleSave = (delayMs: number) => {
      timeoutId = window.setTimeout(() => {
        if (cancelled) return;

        const execute = async () => {
          if (cancelled) return;
          try {
            await sessionRecoveryService.saveBackup(latestStateRef.current);
          } catch (error) {
            console.warn('[SessionRecovery] Periodic backup failed:', error);
          } finally {
            if (!cancelled) scheduleSave(15000);
          }
        };

        if ('requestIdleCallback' in window) {
          idleCallbackId = window.requestIdleCallback(() => { void execute(); }, { timeout: 2000 });
        } else {
          void execute();
        }
      }, delayMs);
    };

    scheduleSave(5000);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [isReady]);

  // Before unload handler to mark clean exit
  useEffect(() => {
    const handleUnload = () => {
      localStorage.setItem('cuebook_session_clean_exit_fallback', 'true');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return { backupData, setBackupData, showRecoveryModal, setShowRecoveryModal };
}
