import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Copy, Check, Download } from 'lucide-react';
import { networkMonitor, maskSensitiveData } from '../services/NetworkMonitor';
import { errorLogger } from '../services/ErrorLogger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showLogs: boolean;
  copied: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    showLogs: false,
    copied: false
  };

  public componentDidMount() {
    window.addEventListener('error', this.handleGlobalError);
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  public componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  private handleGlobalError = (event: ErrorEvent) => {
    if (this.state.hasError) return;
    
    const message = event.message || '';
    const errorMsg = event.error?.message || '';
    if (
      message === 'Script error.' || 
      message.includes('Script error') ||
      errorMsg === 'Script error.' ||
      errorMsg.includes('Script error')
    ) {
      console.warn('[ErrorBoundary] Ignored window "Script error." event to prevent false-positive app crashes.');
      return;
    }

    this.setState({
      hasError: true,
      error: event.error || new Error(`ERR_RUNTIME: ${event.message || 'Unknown execution error'}`)
    });
  };

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    if (this.state.hasError) return;
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    
    if (message === 'Script error.' || message.includes('Script error')) {
      console.warn('[ErrorBoundary] Ignored promise-rejection "Script error." event.');
      return;
    }

    const error = reason instanceof Error ? reason : new Error(`ERR_RUNTIME: ${String(reason)}`);
    this.setState({
      hasError: true,
      error
    });
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showLogs: false, copied: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    errorLogger.logError(error, 'ReactErrorBoundary', errorInfo.componentStack || undefined);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, showLogs: false });
    window.location.reload();
  };

  private handleCopyLog = () => {
    const errorLog = {
      message: maskSensitiveData(this.state.error?.message || ''),
      stack: maskSensitiveData(this.state.error?.stack || ''),
      timestamp: new Date().toISOString(),
      url: '[MASKED_URL_SENSITIVE]',
      userAgent: navigator.userAgent
    };
    navigator.clipboard.writeText(JSON.stringify(errorLog, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 9000);
  };

  private handleDownloadDiagnosticReport = () => {
    const diagnosticReport = networkMonitor.generateDiagnosticReport('player', {
      lastCrashError: this.state.error?.message,
      lastCrashStack: this.state.error?.stack,
    });
    const blob = new Blob([diagnosticReport], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuebook-crash-diagnostics-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = '予期しないエラーが発生しました。';
      let isFirestoreError = false;
      let errorCategory = 'エラー（システム環境）';

      const rawMessage = this.state.error?.message || '';

      if (rawMessage.includes('FERR_TYPE')) {
        errorMessage = '読み込もうとしたオーディオ素材の形式が不正です。ファイル形式が正しいか確認してください。 (FERR_TYPE)';
        errorCategory = 'オーディオ形式エラー';
      } else if (rawMessage.includes('FERR_EMPTY')) {
        errorMessage = '読み込んだオーディオデータが空、または壊れています。 (FERR_EMPTY)';
        errorCategory = '空データエラー';
      } else if (rawMessage.includes('FERR_')) {
        const code = rawMessage.match(/FERR_\w+/)?.[0] || 'FERR_XXX';
        errorMessage = `HTTP通信中に接続エラーが発生しました（コード: ${code}）。ネットワーク状態が一時的に不安定な可能性があります。`;
        errorCategory = 'ネットワーク通信エラー';
      } else if (rawMessage.includes('DERR_01')) {
        errorMessage = '音声データのデコード（解析）に失敗しました。ファイル破損か、非対応コーデックの可能性があります。 (DERR_01)';
        errorCategory = 'オーディオデコードエラー';
      } else if (rawMessage.includes('ERR_RUNTIME')) {
        errorMessage = `プログラムの実行中に一時的なエラーが検出されました。下記の復旧ボタンからアプリを安全に再読み込み（リフレッシュ）できます。`;
        errorCategory = 'システム実行時エラー (ERR_RUNTIME)';
      } else {
        try {
          if (this.state.error?.message) {
            const parsed = JSON.parse(this.state.error.message);
            if (parsed.error && parsed.operationType) {
              errorMessage = `同期データベースとの通信中にエラーを検出しました（操作: ${parsed.operationType}）。`;
              isFirestoreError = true;
              errorCategory = 'データベース同期エラー';
            }
          }
        } catch {
          errorMessage = this.state.error?.message || errorMessage;
        }
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#050505] p-6 overflow-y-auto">
          <div className="max-w-2xl w-full bg-black/60 backdrop-blur-xl border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-6">
              <AlertTriangle className="text-red-500 animate-pulse" size={32} />
            </div>
            
            <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black tracking-widest font-sans uppercase">
              {errorCategory}
            </span>

            <h1 className="text-2xl font-cinzel font-bold text-white mt-3 mb-4 tracking-wider uppercase">
              System Recovery
            </h1>
            
            <div className="bg-white/5 rounded-xl p-6 mb-8 text-left border border-white/5">
              <p className="text-sm text-white/90 leading-relaxed font-medium mb-1">
                {errorMessage}
              </p>
              {isFirestoreError && (
                <p className="text-[10px] text-amber-500/80 mt-2 uppercase tracking-widest font-bold">
                  ネットワークの接続状況や、同一時間帯のデータベース利用制限（Firestoreクォータ）をご確認ください
                </p>
              )}

              <div className="mt-6 border-t border-white/5 pt-4">
                <button 
                  onClick={() => this.setState({ showLogs: !this.state.showLogs })}
                  className="flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-white/60 transition-colors uppercase tracking-widest"
                >
                  {this.state.showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  技術エラー詳細ログ (デバッグ用)
                </button>
                
                {this.state.showLogs && (
                  <div className="mt-3 relative">
                    <pre className="p-4 bg-black/60 rounded-lg text-[10px] text-zinc-500 font-mono overflow-x-auto max-h-[180px] scrollbar-thin border border-white/5 pr-20">
                      {maskSensitiveData(this.state.error?.stack || this.state.error?.message || '')}
                    </pre>
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <button 
                        onClick={this.handleCopyLog}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white"
                        title="クリップボードにコピー"
                      >
                        {this.state.copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      </button>
                      <button 
                        onClick={this.handleDownloadDiagnosticReport}
                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded-md transition-all text-white/40 hover:text-white"
                        title="診断書をダウンロード"
                      >
                        <Download size={13} className="text-white/60 hover:text-white" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white font-bold transition-all active:scale-95"
              >
                <RotateCcw size={18} />
                アプリケーションを今すぐ再起動
              </button>
              <a 
                href="https://forms.gle/oQ9mSQaCwPHP6TNA9" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 rounded-xl text-red-400 font-bold transition-all active:scale-95 text-sm"
              >
                <AlertTriangle size={18} />
                バグレポート送信 (外部窓口)
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
