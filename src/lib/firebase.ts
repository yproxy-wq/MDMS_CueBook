import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, disableNetwork, enableNetwork } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { networkMonitor } from '../services/NetworkMonitor';
import { errorLogger } from '../services/ErrorLogger';

const runtimeEnv = import.meta.env as Record<string, string | undefined>;
const useRuntimeFirebaseConfig = Boolean(runtimeEnv.VITE_FIREBASE_PROJECT_ID);
const resolvedFirebaseConfig = useRuntimeFirebaseConfig
  ? {
      apiKey: runtimeEnv.VITE_FIREBASE_API_KEY,
      authDomain: runtimeEnv.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: runtimeEnv.VITE_FIREBASE_PROJECT_ID,
      storageBucket: runtimeEnv.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: runtimeEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: runtimeEnv.VITE_FIREBASE_APP_ID,
      measurementId: runtimeEnv.VITE_FIREBASE_MEASUREMENT_ID,
    }
  : firebaseConfig;
const firestoreDatabaseId = useRuntimeFirebaseConfig ? runtimeEnv.VITE_FIREBASE_DATABASE_ID : firebaseConfig.firestoreDatabaseId;

const app = getApps().length === 0 ? initializeApp(resolvedFirebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const QUOTA_STORAGE_KEY = 'cuebook_firestore_quota_exceeded_timestamp';
const QUOTA_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours cooldown

const checkIsQuotaStored = (): boolean => {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!val) return false;
    const timestamp = parseInt(val, 10);
    if (isNaN(timestamp)) return false;
    if (Date.now() - timestamp < QUOTA_COOLDOWN_MS) {
      return true;
    }
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
};

const storeQuotaExceeded = () => {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore StorageError
  }
};

let quotaExceeded = checkIsQuotaStored();

// If quota is already exceeded, don't wait for errors, disable network immediately
if (quotaExceeded) {
  console.warn('[Firebase] Started in offline mode because Firestore Quota was previously exhausted.');
  disableNetwork(db).catch(() => {});
}

const quotaListeners = new Set<() => void>();

export const isQuotaExceeded = () => quotaExceeded;

export const clearQuotaExceeded = async () => {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    quotaExceeded = false;
    await enableNetwork(db);
    console.log('[Firebase] Manually re-enabled Firestore network.');
    quotaListeners.forEach(listener => {
      try {
        listener();
      } catch (e) {
        console.error('[Firebase] Error in quota listener during reset:', e);
      }
    });
  } catch (err) {
    console.error('[Firebase] Error resetting quota exceeded state:', err);
    throw err;
  }
};

export const addQuotaListener = (listener: () => void) => {
  quotaListeners.add(listener);
  if (quotaExceeded) {
    setTimeout(listener, 0);
  }
  return () => {
    quotaListeners.delete(listener);
  };
};

let legacyListener: (() => void) | null = null;
export const setOnQuotaExceededListener = (listener: (() => void) | null) => {
  if (legacyListener) {
    quotaListeners.delete(legacyListener);
  }
  legacyListener = listener;
  if (listener) {
    quotaListeners.add(listener);
    if (quotaExceeded) {
      setTimeout(listener, 0);
    }
  }
};

function maskEmail(email: string | null | undefined): string | null | undefined {
  if (!email) return email;
  const parts = email.split('@');
  if (parts.length !== 2) return '******';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local.charAt(0)}*@${domain}`;
  }
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

function maskDisplayName(name: string | null | undefined): string | null | undefined {
  if (!name) return name;
  if (name.length <= 1) return '*';
  return `${name.charAt(0)}${'*'.repeat(Math.min(name.length - 1, 10))}`;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';

  // Handle transient/offline connection status gracefully without crashing the app
  if (
    errorCode === 'unavailable' || 
    errorMessage.includes('Could not reach Cloud Firestore backend') || 
    errorMessage.includes('client is offline') ||
    errorMessage.includes('offline')
  ) {
    console.warn(`[Firebase] Connection state (Firestore auto-retrying): ${errorMessage}`);
    return;
  }
  
  // Check for quota exceeded error (code or message)
  if (errorCode === 'resource-exhausted' || errorMessage.includes('Quota exceeded') || errorMessage.includes('resource-exhausted')) {
    networkMonitor.recordGeneralError('FIRESTORE_QUOTA', 'Firestore Quota Exhausted! Switching to local state.', `${operationType} ${path || ''}`);

    if (!quotaExceeded) {
      quotaExceeded = true;
      storeQuotaExceeded();
      console.warn('[Firebase] Firestore Quota Exhausted! Automatically switching to safely isolated Local/Offline state.');
      
      quotaListeners.forEach(listener => {
        try {
          listener();
        } catch (e) {
          console.error('[Firebase] Error in quota listener:', e);
        }
      });

      // Force block ongoing retries by disabling Firestore network connection
      disableNetwork(db).catch(err => {
        console.error('[Firebase] Error while stopping Firestore connection: ', err);
      });
    }
  } else {
    // Log standard firestore operational failures as well
    networkMonitor.recordGeneralError('FIRESTORE_OP_ERR', `ErrorCode: ${errorCode || 'unknown'} - Msg: ${errorMessage}`, `${operationType} ${path || ''}`);
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: maskEmail(auth.currentUser?.email),
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: maskDisplayName(provider.displayName),
        email: maskEmail(provider.email),
        photoUrl: provider.photoURL ? 'https://example.com/masked_photo' : null
      })) || []
    },
    operationType,
    path
  }

  // Dynamic import of ErrorLogger to prevent circular initialization with maskSensitiveData
  errorLogger.logError(error instanceof Error ? error : new Error(errorMessage), `Firestore::${operationType}::${path || 'unknown'}`);

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection was removed to prevent transient startup connection warnings.

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};
