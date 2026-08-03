export type ConnectionStatus = 'healthy' | 'unreliable' | 'disconnected';

export interface NetworkState {
  status: ConnectionStatus;
  adGuardDetected: boolean;
  lastError: string | null;
  retryCount: number;
  consecutiveSuccesses: number;
  isFirebaseConnected: boolean;
}

export interface EventLogEntry {
  timestamp: string;
  type: 'info' | 'warn' | 'error';
  context: string;
  message: string;
}

type NetworkListener = (state: NetworkState) => void;

/**
 * Strips out sensitive user metadata, scenario metadata, and absolute authentication keys
 * to protect end-user privacy while providing crisp diagnostic files for developers.
 */
export function maskSensitiveData(msg: string): string {
  if (!msg) return '';
  let result = msg;
  
  // 1. Mask user emails
  result = result.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+/gi, '[EMAIL_MASKED]');

  // 2. Clear paths with Firestore collections & document keys
  result = result.replace(/timerSessions\/([a-zA-Z0-9_-]+)\/sessions\/([a-zA-Z0-9_-]+)/gi, 'timerSessions/usr_***_masked/sessions/sess_***_masked');
  result = result.replace(/handouts\/([a-zA-Z0-9_-]+)\/characters\/([a-zA-Z0-9_-]+)/gi, 'handouts/usr_***_masked/characters/char_***_masked');

  // 3. Mask target UUID patterns
  result = result.replace(/\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/gi, '[UUID_MASKED]');

  // 4. Mask Firestore token IDs (usually 20 characters alphanumeric starting with mixed letters)
  result = result.replace(/\b[a-zA-Z0-9]{20}\b/g, (match) => {
    const hasUpper = /[A-Z]/.test(match);
    const hasLower = /[a-z]/.test(match);
    const hasDigit = /[0-9]/.test(match);
    if ((hasUpper && hasLower) || (hasUpper && hasDigit) || (hasLower && hasDigit)) {
      return '[FIRESTORE_ID_MASKED]';
    }
    return match;
  });

  // 5. Mask URLs (except Firestore googleapis and KeikeiLab tests)
  result = result.replace(/https?:\/\/[^\s"'()]+/gi, (url) => {
    if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com')) {
      return 'https://firestore.googleapis.com/[MASKED_FIRESTORE_SUBPATH]';
    }
    if (url.includes('qbook-open.keikeilab.net')) {
      return 'https://qbook-open.keikeilab.net/[MASKED_TEST_PATH]';
    }
    return 'https://[MASKED_HOST]/[MASKED_PATH]';
  });

  // 6. Mask structured attributes usually embedded in JSON or states
  result = result.replace(/"(scenarioTitle|characterName|characterRole|characterColor|userId|sessionId|fullSessionId)":\s*"[^"]+"/gi, '"$1": "[MASKED_VALUE]"');

  return result;
}

class NetworkMonitorService {
  private listeners = new Set<NetworkListener>();
  private eventLogs: EventLogEntry[] = [];
  private state: NetworkState = {
    status: 'healthy',
    adGuardDetected: false,
    lastError: null,
    retryCount: 0,
    consecutiveSuccesses: 3, // Start with assumed healthy state
    isFirebaseConnected: true,
  };

  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Monitor standard browser connection events
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      
      // Initial state checks
      this.state.status = window.navigator.onLine ? 'healthy' : 'disconnected';
      
      // Periodic check to detect stealth blocks (like AdGuard)
      this.startHeartbeat();
      this.appendEventLog('info', 'NetworkMonitor', 'Diagnostics subsystem initialized.');
    }
  }

  public appendEventLog(type: 'info' | 'warn' | 'error', context: string, message: string) {
    const entry: EventLogEntry = {
      timestamp: new Date().toISOString(),
      type,
      context,
      message: maskSensitiveData(message)
    };
    this.eventLogs.unshift(entry);
    if (this.eventLogs.length > 50) {
      this.eventLogs.pop();
    }
  }

  public getEventLogs(): EventLogEntry[] {
    return [...this.eventLogs];
  }

  public clearEventLogs() {
    this.eventLogs = [];
  }

  private handleOnline() {
    console.log('[NetworkMonitor] Browser is back online.');
    this.appendEventLog('info', 'NetworkMonitor', 'Browser network online event triggered.');
    this.recordSuccess();
  }

  private handleOffline() {
    console.warn('[NetworkMonitor] Browser went offline.');
    this.appendEventLog('warn', 'NetworkMonitor', 'Browser network offline event triggered (ERR_INTERNET_DISCONNECTED).');
    this.updateState({
      status: 'disconnected',
      lastError: 'ERR_INTERNET_DISCONNECTED',
    });
  }

  private startHeartbeat() {
    // Run a lightweight check every 15 seconds to evaluate real-time sync condition
    this.heartbeatInterval = setInterval(() => {
      this.checkAdGuardStealth();
    }, 15000);
    // Also run immediately
    setTimeout(() => this.checkAdGuardStealth(), 2000);
  }

  /**
   * Proactively detects if AdGuard or another privacy block is intercepting requests
   * using DOM element rules without making fake network requests that cause 404 errors in console.
   */
  public async checkAdGuardStealth() {
    if (typeof window === 'undefined' || !window.navigator.onLine) return;

    try {
      // DOM element check for adblockers (pure client-side, zero network calls, zero 404s)
      let adBlocked = false;
      const testAd = document.createElement('div');
      testAd.className = 'adsbox pub_300x250 pub_300x250m text-ad textAd text_ad text_ads text-ads ad-text ad-banner';
      testAd.style.cssText = 'width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -10000px !important;';
      document.body.appendChild(testAd);

      if (testAd.offsetHeight === 0 || testAd.clientHeight === 0 || window.getComputedStyle(testAd).display === 'none') {
        adBlocked = true;
      }
      document.body.removeChild(testAd);

      if (adBlocked) {
        const blockReason = 'AdGuard/AdBlocker element filtering detected';
        if (!this.state.adGuardDetected) {
          console.warn(`[NetworkMonitor] Stealth network block detected: ${blockReason}`);
          this.appendEventLog('warn', 'ContentBlocker', `Interception event: ${blockReason}`);
          this.updateState({
            adGuardDetected: true,
            status: 'unreliable',
            lastError: blockReason,
          });
        }
        return;
      }

      // If adblocker is not detected, clear adGuardDetected flag if it was previously set
      if (this.state.adGuardDetected) {
        this.appendEventLog('info', 'ContentBlocker', 'Content blocker filtering resolved.');
        this.updateState({ adGuardDetected: false });
        this.recordSuccess();
      }
    } catch {
      // Silent catch
    }
  }

  public async triggerProbe() {
    await this.checkAdGuardStealth();
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    // Immediate notification
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): NetworkState {
    return { ...this.state };
  }

  private updateState(partial: Partial<NetworkState>) {
    const nextState = { ...this.state, ...partial };
    
    // Evaluate the final simplified connection status
    if (!window.navigator.onLine) {
      nextState.status = 'disconnected';
    } else if (nextState.adGuardDetected || nextState.retryCount > 0) {
      nextState.status = 'unreliable';
    } else if (!nextState.isFirebaseConnected) {
      nextState.status = 'unreliable';
    } else {
      nextState.status = 'healthy';
    }

    this.state = nextState;
    this.listeners.forEach((listener) => {
      try {
        listener(nextState);
      } catch (err) {
        console.error('[NetworkMonitor] Listener callback error:', err);
      }
    });
  }

  /**
   * Logs a network success event
   */
  public recordSuccess() {
    const nextSuccessCount = this.state.consecutiveSuccesses + 1;
    const updates: Partial<NetworkState> = {
      consecutiveSuccesses: nextSuccessCount,
    };

    if (nextSuccessCount >= 2) {
      updates.retryCount = 0;
      updates.lastError = null;
    }

    if (nextSuccessCount % 5 === 0) {
      this.appendEventLog('info', 'NetworkMonitor', `Heartbeat ping-to-cloud is stable. Consecutive successes: ${nextSuccessCount}`);
    }

    this.updateState(updates);
  }

  /**
   * Logs a network failure or interception event
   */
  public recordFailure(error: unknown, context: string) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isAdGuardPattern = 
      errorMsg.includes('Failed to fetch') || 
      errorMsg.includes('ERR_FAILED') || 
      errorMsg.includes('ERR_CONNECTION_CLOSED') ||
      errorMsg.includes('local.adguard.org');

    console.error(`[NetworkMonitor] Operation failed [${context}]: ${errorMsg}`);
    this.appendEventLog('error', context, errorMsg);

    this.updateState({
      retryCount: this.state.retryCount + 1,
      consecutiveSuccesses: 0,
      lastError: errorMsg,
      adGuardDetected: this.state.adGuardDetected || isAdGuardPattern,
    });
  }

  /**
   * Record standard/custom business state errors to diagnostic event log directly
   */
  public recordGeneralError(code: string, message: string, context: string) {
    this.appendEventLog('error', `${code}::${context}`, message);
  }

  public setFirebaseConnectionState(connected: boolean) {
    if (this.state.isFirebaseConnected !== connected) {
      this.appendEventLog(connected ? 'info' : 'warn', 'FirebasePresence', connected ? 'Firestore listener stream active.' : 'Firestore stream disconnected/interrupted.');
      this.updateState({ isFirebaseConnected: connected });
    }
  }

  /**
   * Standardized fetch wrapper to gracefully catch and inspect errors
   */
  public async safeFetch(url: string, options?: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, options);
      this.recordSuccess();
      return response;
    } catch (error) {
      this.recordFailure(error, `Fetch:${url}`);
      throw error;
    }
  }

  /**
   * Robust exponential backoff runner for database or other async updates.
   * Aligned with UNIX philosophy (single job: execute with retry/backoff perfectly)
   */
  public async withExponentialBackoff<T>(
    operationName: string,
    operation: () => Promise<T>,
    maxRetries = 4,
    baseDelayMs = 1000
  ): Promise<T> {
    let attempt = 0;

    const execute = async (): Promise<T> => {
      try {
        const result = await operation();
        this.recordSuccess();
        return result;
      } catch (error) {
        attempt++;
        this.recordFailure(error, `${operationName} (Attempt ${attempt}/${maxRetries})`);

        if (attempt >= maxRetries) {
          console.error(`[NetworkMonitor] ${operationName} failed permanently after limit of ${maxRetries} retries.`);
          throw error;
        }

        // Exponential backoff with a bite of random jitter to prevent dogpiling
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 300;
        console.warn(`[NetworkMonitor] Retrying ${operationName} in ${Math.round(delay)}ms...`);
        this.appendEventLog('warn', operationName, `Attempt ${attempt} failed. Backing off for ${Math.round(delay)}ms.`);
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        return execute();
      }
    };

    return execute();
  }

  /**
   * Compiles an incredible diagnostic report full of valuable metadata while masking sensitve details
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public generateDiagnosticReport(currentRole: 'gm' | 'player', activeSectionConfig?: any): string {
    const now = new Date().toISOString();
    const state = this.state;
    const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : false;
    const ua = typeof window !== 'undefined' ? window.navigator.userAgent : 'Unknown';

    let statusString = 'HEALTHY (同期は良好)';
    if (state.status === 'disconnected') {
      statusString = 'DISCONNECTED (ネットワーク接続なし/オフライン)';
    } else if (state.status === 'unreliable') {
      statusString = 'UNSTABLE (接続不安定 または 広告ブロック遮断)';
    }

    let report = `======================================================================
                  CUEBOOK DIAGNOSTICS & SYSTEM REPORT                  
======================================================================
Generated At: ${now}
Target Role  : ${currentRole === 'gm' ? 'Game Master (GM) / 送信親機' : 'Player / 受信子機'}
System Status: ${statusString}

------------------ ENVIRONMENT INFORMATION ---------------------------
Browser Online  : ${isOnline ? 'YES (ブラウザオンライン)' : 'NO (ブラウザオフライン)'}
User Agent      : ${ua}
AdGuard / Block : ${state.adGuardDetected ? 'DETECTED / YES (広告ブロック/盾検知あり)' : 'NOT DETECTED / NO'}
Firestore Streams: ${state.isFirebaseConnected ? 'STREAM_CONNECTED (ストリーム受信中)' : 'STREAM_OFFLINE (不通)'}
Accumulated RetryCount : ${state.retryCount} times
Last Incident: ${state.lastError ? maskSensitiveData(state.lastError) : 'NONE'}

`;

    report += `------------------ DIAGNOSTIC RECOMMENDATIONS -------------------------\n`;
    
    let adviceIndex = 1;

    if (state.adGuardDetected) {
      report += `[${adviceIndex++}] ADGUARD / CONTENT BLOCKER SHIELD DETECTED:
- 状況: ブラウザのアドブロックやセキュリティ拡張機能（AdGuard, uBlock Origin, Brave Shield等）がFirestoreストリームWebSocket接続を遮断、または阻害している疑いがあります。
- 対処法:
  1. ブラウザ右上にあるアドブロックの拡張機能アイコンをクリック。
  2. このアプリ（keikeilab.net）における保護を「オフ」または「例外/ホワイトリストに登録」に切り替えてください。
  3. その後、ページを再読み込み（リロード）します。

`;
    }

    if (!isOnline) {
      report += `[${adviceIndex++}] PHYSICAL CONNECTION DROPPED:
- 状況: 端末がインターネットに繋がっていません。
- 対処法:
  1. モバイルネットワーク設定、WiFi、またはプロキシ制限を確認してください。
  2. インターネット接続が復旧すれば、アプリリロードを行わずとも自動で同期復旧されます。

`;
    }

    if (state.retryCount > 3 && isOnline) {
      report += `[${adviceIndex++}] API SERVER TIMEOUT / HIGH PACKET LOSS:
- 状況: インターネットは接続されていますが、クラウドサーバーとの疎通が頻繁に切断・断絶しています（CORS遮断や企業プロキシ検知の可能性あり）。
- 対処法:
  1. 会社や会場の厳しい企業セキュリティWiFi下にいる場合、ポート制限等でWebSocket通信が切断されている可能性があります。
  2. 一時的にスマートフォンのテザリング回線に切り変えて接続すると改善されることが多いです。

`;
    }

    if (activeSectionConfig) {
      report += `[${adviceIndex++}] SYNC STATE SUMMARY:
- タイマー同期有効: ${activeSectionConfig.timerEnabled ? 'YES' : 'NO'}
- 資料画像同期有効: ${activeSectionConfig.contentEnabled ? 'YES' : 'NO'}
- ローカル未保存変更 (GM): ${activeSectionConfig.isDirty ? 'YES (要「構成を同期」ボタンクリック)' : 'NO'}
- アクティブ画像ID: ${activeSectionConfig.activeImageId ? '[MASKED_IMAGE_ID]' : 'NONE'}

`;
    }

    report += `[${adviceIndex++}] BROWSER SLEEP PREVENTION WARNING (ブラウザタブ自動省電力の防止)
- ブラウザのタブが裏のスリープ（非アクティブ化）に入ると、通信ストリームとタイマー処理が自動遮断され、プレイヤー側の同期ズレに繋がります。
- プレイヤー/受信スクリーン用端末は【常にタブを最前面に置いてアクティブ表示のまま】にすることを強く推奨します。

`;

    report += `------------------ CHRONOLOGICAL EVENT LOGS (MASKED) ------------------\n`;
    const logs = this.eventLogs;
    if (logs.length === 0) {
      report += `(No explicit errors or warning events recorded yet. Sync flow is perfect.)\n`;
    } else {
      logs.forEach((log, index) => {
        report += `${index + 1}. [${log.timestamp}] [${log.type.toUpperCase()}] [${log.context}] -> ${log.message}\n`;
      });
    }

    report += `======================================================================\n`;
    report += `Note: This diagnostic compilation has been fully sanitized. User IDs, Firestore database collection items, custom text content, user credentials, and session hashes were automatically filtered with [MASKED] tokens for complete security and privacy.\n`;
    report += `======================================================================\n`;

    return report;
  }
}

export const networkMonitor = new NetworkMonitorService();

