import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, logout, signInWithGoogle } from '../lib/firebase';
import { syncService } from '../services/SyncService';
import { createTimerSessionId, isSecureShareId } from '../utils/syncHelper';
import { errorLogger } from '../services/ErrorLogger';

export function useAppAuthentication(
  syncShareId: string | undefined,
  setShowLoginConfirmation: (show: boolean) => void,
) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, nextUser => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = useCallback(() => {
    setShowLoginConfirmation(true);
  }, [setShowLoginConfirmation]);

  const handleConfirmLogin = useCallback(async () => {
    setShowLoginConfirmation(false);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed', error);
      errorLogger.logOperationError(error, {
        code: 'AUTH_LOGIN_FAILED', operation: 'auth.login', recoverable: true,
      });
    }
  }, [setShowLoginConfirmation]);

  const handleLogout = useCallback(async () => {
    try {
      if (user && isSecureShareId(syncShareId)) {
        syncService.clearSession(createTimerSessionId(user.uid, syncShareId));
      }
      await logout();
    } catch (error) {
      console.error('Logout failed', error);
      errorLogger.logOperationError(error, {
        code: 'AUTH_LOGOUT_FAILED', operation: 'auth.logout', recoverable: true,
      });
    }
  }, [syncShareId, user]);

  return { user, authReady, handleLogin, handleConfirmLogin, handleLogout };
}
