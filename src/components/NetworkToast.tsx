import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { networkMonitor, NetworkState } from '../services/NetworkMonitor';

interface NetworkToastProps {
  onOpenTroubleshooter?: () => void;
}

export const NetworkToast: React.FC<NetworkToastProps> = ({ onOpenTroubleshooter }) => {
  const [netState, setNetState] = useState<NetworkState>(() => networkMonitor.getState());
  const [dismissedStatus, setDismissedStatus] = useState<string | null>(null);
  const [showRestored, setShowRestored] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const prevStatusRef = useRef(netState.status);

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe((newState) => {
      // Check if connection was restored
      if (
        (prevStatusRef.current === 'disconnected' || prevStatusRef.current === 'unreliable') &&
        newState.status === 'healthy'
      ) {
        setShowRestored(true);
        const timer = setTimeout(() => {
          setShowRestored(false);
        }, 9000);
        return () => clearTimeout(timer);
      }
      
      prevStatusRef.current = newState.status;
      setNetState(newState);
      setIsReconnecting(false);
    });

    return unsubscribe;
  }, []);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    await networkMonitor.triggerProbe();
    setTimeout(() => setIsReconnecting(false), 1200);
  };

  const isDisconnected = netState.status === 'disconnected';
  const isUnreliable = netState.status === 'unreliable' || netState.adGuardDetected;

  // Don't render if healthy (unless showing restored toast) or if user dismissed this status
  if (!showRestored && !isDisconnected && !isUnreliable) {
    return null;
  }

  const currentKey = isDisconnected ? 'disconnected' : isUnreliable ? 'unreliable' : 'restored';
  if (dismissedStatus === currentKey && !showRestored) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100000] max-w-lg w-[92vw] pointer-events-auto">
      <AnimatePresence mode="wait">
        {showRestored ? (
          <motion.div
            key="restored"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-emerald-950/95 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-[0_10px_30px_rgba(16,185,129,0.2)] backdrop-blur-xl flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 font-sans">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-white font-cinzel tracking-wider">クラウド接続が復旧しました</span>
                <span className="text-[10px] text-emerald-300/80">同期通信が正常に再開されました。</span>
              </div>
            </div>
            <button
              onClick={() => setShowRestored(false)}
              className="p-1 text-emerald-400/60 hover:text-emerald-200 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ) : isDisconnected ? (
          <motion.div
            key="disconnected"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-red-950/95 border border-red-500/40 text-red-200 p-4 rounded-2xl shadow-[0_10px_40px_rgba(239,68,68,0.3)] backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse shrink-0">
                <WifiOff size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-white font-cinzel tracking-wider">⚠️ ネットワークが切断されました</span>
                <span className="text-[10px] text-red-300/80 leading-tight">
                  オフラインで動作中（自動再接続を試行しています...）
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-red-500/20">
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="px-3 py-1.5 rounded-xl bg-red-500 text-white font-bold font-cinzel text-[10px] tracking-wider hover:bg-red-400 active:scale-95 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <RefreshCw size={12} className={isReconnecting ? 'animate-spin' : ''} />
                <span>再接続</span>
              </button>
              {onOpenTroubleshooter && (
                <button
                  onClick={onOpenTroubleshooter}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 text-white/80 hover:text-white hover:bg-white/20 font-bold font-cinzel text-[10px] transition-all"
                >
                  診断
                </button>
              )}
              <button
                onClick={() => setDismissedStatus('disconnected')}
                className="p-1 text-red-400/60 hover:text-red-200 transition-colors"
                title="閉じる"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ) : isUnreliable ? (
          <motion.div
            key="unreliable"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="bg-amber-950/95 border border-amber-500/40 text-amber-200 p-4 rounded-2xl shadow-[0_10px_40px_rgba(245,158,11,0.25)] backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-white font-cinzel tracking-wider">⚡ 接続不安定 / ブロックの可能性</span>
                <span className="text-[10px] text-amber-300/80 leading-tight">
                  {netState.adGuardDetected
                    ? 'アドブロック等のコンテンツブロッカーが同期通信を妨害している可能性があります'
                    : 'クラウド同期の応答が遅延しています'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-500/20">
              <button
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-bold font-cinzel text-[10px] tracking-wider hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                <RefreshCw size={12} className={isReconnecting ? 'animate-spin' : ''} />
                <span>テスト</span>
              </button>
              {onOpenTroubleshooter && (
                <button
                  onClick={onOpenTroubleshooter}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 text-white/80 hover:text-white hover:bg-white/20 font-bold font-cinzel text-[10px] transition-all"
                >
                  診断
                </button>
              )}
              <button
                onClick={() => setDismissedStatus('unreliable')}
                className="p-1 text-amber-400/60 hover:text-amber-200 transition-colors"
                title="閉じる"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
