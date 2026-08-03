import React, { useState, useEffect } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, AlertTriangle, Copy, Download, Check, ShieldCheck, Trash } from 'lucide-react';
import { networkMonitor } from '../services/NetworkMonitor';
import { errorLogger, LoggedError } from '../services/ErrorLogger';
import { clearQuotaExceeded } from '../lib/firebase';

interface SyncTroubleshooterProps {
  quotaExceeded: boolean;
  isDirty: boolean;
  timerEnabled: boolean;
  contentEnabled: boolean;
  activeImageId: string | null;
  isGM: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SyncTroubleshooter: React.FC<SyncTroubleshooterProps> = ({
  quotaExceeded,
  isDirty,
  timerEnabled,
  contentEnabled,
  activeImageId,
  isGM,
  isOpen: isOpenProp,
  onClose
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = isOpenProp !== undefined ? isOpenProp : internalIsOpen;
  const [copied, setCopied] = useState(false);
  const [loggedErrors, setLoggedErrors] = useState<LoggedError[]>(() => errorLogger.getErrors());

  const handleToggle = () => {
    if (isOpenProp !== undefined && onClose) {
      if (isOpenProp) onClose();
    } else {
      setInternalIsOpen(!internalIsOpen);
    }
  };

  useEffect(() => {
    return errorLogger.subscribe(setLoggedErrors);
  }, []);

  const handleCopyReport = () => {
    const report = networkMonitor.generateDiagnosticReport(isGM ? 'gm' : 'player', {
      quotaExceeded,
      isDirty,
      timerEnabled,
      contentEnabled,
      activeImageId
    });
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 9000);
  };

  const handleDownloadReport = () => {
    const report = networkMonitor.generateDiagnosticReport(isGM ? 'gm' : 'player', {
      quotaExceeded,
      isDirty,
      timerEnabled,
      contentEnabled,
      activeImageId
    });
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuebook-diagnostics-${isGM ? 'gm' : 'player'}-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border border-white/10 rounded-2xl bg-zinc-950 overflow-hidden transition-all duration-300">
      <button
        onClick={handleToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-all"
        id="sync-troubleshooter-toggle"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle size={15} className="text-amber-400 animate-pulse" />
          <span className="text-[10.5px] font-bold font-cinzel text-white/80 tracking-widest uppercase">
            同期がうまくいかないときは？
          </span>
        </div>
        {isOpen ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-white/5 bg-black/40 text-[10.5px] leading-relaxed">
          <div className="space-y-2">
            <h5 className="text-[8.5px] font-bold font-cinzel text-white/50 uppercase tracking-widest mb-1.5">
              セルフ自己診断 (Diagnostics)
            </h5>
            
            {/* 1. Quota Check */}
            <div className="flex items-start gap-2.5 py-1.5 border-b border-white/5">
              {quotaExceeded ? (
                <>
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-red-400">ALERT: Quota Limit Exceeded (制限超過)</p>
                    <p className="text-[9px] text-white/40 mt-1 animate-pulse">
                      Firestore無料枠内の書き込み数上限に達しました。本日の同期は一時停止しますが、ローカルタイマー進行は正常に継続します。クオータ状況の確認やSparkプランからのアップグレードは、以下のコンソールリンクより行えます。
                    </p>
                    <a
                      href="https://console.firebase.google.com/project/gen-lang-client-0664666169/firestore/databases/ai-studio-1c8987be-d77f-408f-bc92-262abe57f70d/data?openUpgradeDialog=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 active:scale-95 rounded text-[8.5px] font-mono transition-all uppercase"
                    >
                      Firebase Console ↗ (Upgrade & Metrics)
                    </a>
                    <button
                      onClick={async () => {
                        try {
                          await clearQuotaExceeded();
                          window.location.reload();
                        } catch (e) {
                          console.error('[Troubleshooter] Failed to manually reset quota/offline block:', e);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 mt-2 ml-2 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 active:scale-95 rounded text-[8.5px] font-mono transition-all uppercase cursor-pointer"
                    >
                      強制再接続 / Cooldownリセット ↻
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 text-xs shrink-0 select-none">●</span>
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-white/80">Quota Status: OK</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      通信枠（Quota）に問題ありません。正常にクラウド経由でリアルタイム双方向伝送を行えます。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 2. Authentication Role */}
            <div className="flex items-start gap-2.5 py-1.5 border-b border-white/5">
              {isGM ? (
                <>
                  <span className="text-emerald-400 text-xs shrink-0 select-none">●</span>
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-white/80">Role Auth Constraints: Game Master (GM)</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      認証されたGMとして動作しています。Firestore上にセッション状態を強制上書き・同期させる書き込み特別権限を保持しています。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-amber-400">Role: Guest Viewer (プレイヤー・観劇者)</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      閲覧端末側モードです。あなた側からタイマー操作、画像変更等はFirestore空間に反映できません（GMからの放送を待ち受ける状態）。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 3. Unsaved Edits */}
            <div className="flex items-start gap-2.5 py-1.5 border-b border-white/5">
              {isDirty ? (
                <>
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-amber-400">Unapplied local changes detected</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      <strong>【注意】</strong>エディタ操作を変更しましたが、まだクラウドに送信されていません。反映させるには、必ず右下の<strong>「構成を同期」</strong>ボタンを押して適用してください（「構成を同期」を押すまで反映されません！）。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-emerald-400 text-xs shrink-0 select-none">●</span>
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-white/80">Broadcast State: Synchronized</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      現在エディタ内の構成情報と、Firestore最新値が完全に一致(送信済み)しています。
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* 4. Muted Switch Check */}
            <div className="flex items-start gap-2.5 py-1.5">
              {!timerEnabled && !contentEnabled ? (
                <>
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-red-300">Synchronized Scope: Zero Content</p>
                    <p className="text-[9px] text-white/40 mt-1">
                      タイマー・画像トグルが両方「HIDDEN」に設定されています。閲覧スクリーンは意図的に「真っ暗（何も表示されない）」状態です。
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-blue-400 text-xs shrink-0 select-none">●</span>
                  <div>
                    <p className="text-[9.5px] font-mono font-bold text-white/80">Synchronized Items</p>
                    <p className="text-[9px] text-white/50 mt-1">
                      アクティブトグル: {timerEnabled ? '経過時間' : ''} {contentEnabled ? '表示資料画像' : ''}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick tips */}
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1 bg-black/60">
            <h6 className="text-[8.5px] font-bold font-mono text-sky-400 uppercase tracking-widest pl-0.5">
              同期成功を高めるための裏技
            </h6>
            <ul className="list-disc pl-4 text-[9px] text-white/50 space-y-1">
              <li>
                <strong>タブの休眠問題:</strong> 受信ディスプレイ側のブラウザタブは<strong>常に最前面（アクティブ状態）</strong>に配置してください。裏で隠れているタブは、ブラウザ仕様の省電力動作によりWebSocket通信が遮断されることがあります。
              </li>
              <li>
                <strong>WebSocketの切断:</strong> ネットが一時的に切れたり画面がおかしい場合は、受信スクリーン右上にある<strong>「再読み込み（Rotate）」</strong>ボタンを一度クリックするのが最も強力なセルフリフレッシュになります。
              </li>
              <li>
                <strong>セッション再創生:</strong> どうしても同期の咬み合わせがズレた場合は、GM側でRESETボタンを物理的に押し、再度「構成を同期」を実行してください。
              </li>
            </ul>
          </div>

          {/* Diagnostic Action Block */}
          <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <h6 className="text-[8.5px] font-bold font-mono text-emerald-400 uppercase tracking-widest">
                システム診断ログ出力 (Secure Diagnostics)
              </h6>
            </div>
            <p className="text-[9px] text-white/40 leading-relaxed">
              不具合や同期の遅れが発生した際、詳細な状況分析ログを書き出し、開発者へ送付(または自己診断)できます。プレイヤーの個人情報やシナリオ名、配布物素材は全て<strong>自動的に匿名化（[MASKED]）</strong>されます。
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleCopyReport}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-lg text-emerald-400 text-[9px] font-bold transition-all active:scale-95"
              >
                {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
                {copied ? 'コピー完了' : '診断書をクリップボードにコピー'}
              </button>
              <button
                onClick={handleDownloadReport}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/80 text-[9px] font-bold transition-all active:scale-95"
              >
                <Download size={11} className="text-white/60" />
                診断書をダウンロード (.txt)
              </button>
            </div>
          </div>

          {/* Persistent Error Logger Analytics Block */}
          <div className="p-4 bg-zinc-900/60 border border-white/5 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={12} className="text-indigo-400 shrink-0" />
                <h6 className="text-[8.5px] font-bold font-mono text-indigo-400 uppercase tracking-widest">
                  エラー自動検知・追跡ログ (Real-time Logger)
                </h6>
              </div>
              {loggedErrors.length > 0 && (
                <button
                  onClick={() => errorLogger.clearErrors()}
                  title="すべてのエラー履歴を消去"
                  className="p-1 text-white/30 hover:text-red-400 rounded transition-all hover:bg-white/5 active:scale-95 flex items-center gap-1 text-[8px] font-bold font-mono uppercase"
                >
                  <Trash size={10} />
                  Clear
                </button>
              )}
            </div>

            {loggedErrors.length === 0 ? (
              <div className="py-2 text-center border border-dashed border-white/5 rounded-lg bg-black/40">
                <p className="text-[9px] text-white/30 font-mono">
                  ● システム正常稼働中 - 常時例外トラップ待機
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pr-1">
                {loggedErrors.map((err) => (
                  <div
                    key={err.id}
                    className={`p-2 rounded-lg border text-[9px] font-mono leading-relaxed transition-all ${
                      err.resolved
                        ? 'bg-zinc-950/40 border-zinc-900/50 opacity-40'
                        : 'bg-black/60 border-red-500/10 hover:border-red-500/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="px-1 py-0.2 bg-red-500/10 text-red-400 border border-red-500/20 text-[7.5px] rounded font-bold uppercase tracking-tight">
                          {err.context}
                        </span>
                        <p className="font-bold text-white/80 mt-1 break-all line-clamp-2">
                          {err.errorMessage}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-[8px] text-white/30">
                          {new Date(err.lastOccurrence).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                          })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {err.count > 1 && (
                            <span className="px-1 bg-amber-500/10 text-amber-400 border border-amber-500/25 text-[8px] rounded font-bold">
                              x{err.count}
                            </span>
                          )}
                          {!err.resolved && (
                            <button
                              onClick={() => errorLogger.resolveError(err.id)}
                              className="text-[8px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase cursor-pointer"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[8px] text-white/20 leading-tight">
              ※ このログはブラウザの localStorage に厳重保存され、個人情報は一切クラウドへ送信されません。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
