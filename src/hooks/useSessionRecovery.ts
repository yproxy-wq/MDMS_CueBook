import { useState, useEffect } from 'react';
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
  }
}

export function useSessionRecovery(isReady: boolean, state: AppState) {
  const [backupData, setBackupData] = useState<{ state: AppState; timestamp: number } | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

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

  // Periodic Auto-save logic (runs when app is ready)
  useEffect(() => {
    if (!isReady) return;

    let timeoutId: number;

    const saveBackup = () => {
      const execute = async () => {
        await sessionRecoveryService.saveBackup(state);
        timeoutId = window.setTimeout(saveBackup, 15000); // Save every 15 seconds
      };

      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(execute, { timeout: 2000 });
      } else {
        execute();
      }
    };

    timeoutId = window.setTimeout(saveBackup, 5000);
    return () => clearTimeout(timeoutId);
  }, [isReady, state]);

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
