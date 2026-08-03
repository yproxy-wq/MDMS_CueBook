import React, { useEffect, useState } from 'react';
import { syncService, HandoutSyncData } from '../services/SyncService';
import HandoutView from './HandoutView';
import { Character, CharacterType } from '../types';
import { Loader2 } from 'lucide-react';
import { isSecureHandoutSessionId } from '../utils/syncHelper';

interface PlayerHandoutLoaderProps {
  characterId: string;
  sessionId: string;
  themeColor: string;
}

const PlayerHandoutLoader: React.FC<PlayerHandoutLoaderProps> = ({ characterId, sessionId, themeColor }) => {
  const [data, setData] = useState<HandoutSyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fullSessionId = isSecureHandoutSessionId(sessionId) ? sessionId : null;
  const displayError = error || (!fullSessionId ? 'この配布リンクは無効または旧形式です。GMから新しいリンクを受け取ってください。' : null);

  useEffect(() => {
    if (!fullSessionId) return;

    console.log(`[PlayerHandoutLoader] Connecting to: ${fullSessionId}`);
    let isMounted = true;
    let receivedUpdate = false;

    const unsubscribe = syncService.subscribeToHandout(fullSessionId, (update) => {
      if (isMounted) {
        console.log(`[PlayerHandoutLoader] Received update:`, update);
        receivedUpdate = true;
        setData(update);
        setLoading(false);
        setError(update ? null : '配布セッションが見つかりません。GMにリンクの再発行を依頼してください。');
      }
    }, (err) => {
      if (isMounted) {
        console.error("Handout subscription error:", err);
        setError(`接続エラー: ${err.message || "権限またはネットワークの問題です"}`);
        setLoading(false);
      }
    });
    
    // Safety timeout: If no data after 10 seconds, and we haven't received anything,
    // tell user we're still waiting.
    const timer = setTimeout(() => {
      if (isMounted && !receivedUpdate) {
        console.warn("[PlayerHandoutLoader] Connection slow or document missing.");
      }
    }, 10000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearTimeout(timer);
    };
  }, [fullSessionId]);

  if (displayError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#050505] p-8 text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 border border-red-500/20">
           <Loader2 size={40} />
        </div>
        <div className="space-y-2">
           <h3 className="text-xl font-cinzel font-bold text-white tracking-widest">ENCRYPTION ERROR</h3>
           <p className="text-xs text-red-400/60 font-mono tracking-wider max-w-sm mx-auto">
             {displayError}
           </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold font-cinzel text-white/40 hover:bg-white/10 hover:text-white transition-all uppercase tracking-widest"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#050505] gap-6">
        <div className="relative">
          <Loader2 className="animate-spin text-white/20" size={64} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-[10px] font-cinzel text-white/20 uppercase tracking-[0.4em] animate-pulse">Establishing Secure Channel</p>
          <p className="text-[8px] font-mono text-white/10 uppercase tracking-widest">Waiting for a secure handout stream</p>
        </div>
      </div>
    );
  }

  const handleNotifyPresence = async () => {
    if (!fullSessionId) return;

    try {
      await syncService.notifyPresence(fullSessionId);
    } catch (err) {
      console.error("Failed to notify presence:", err);
    }
  };

  const mockCharacter: Character = data ? {
    id: data.characterId,
    name: data.characterName,
    role: (data.characterRole as CharacterType) || CharacterType.PC,
    color: data.characterColor || themeColor,
    secretHandout: data.message,
    handoutHistory: data.messages || (data.message ? [data.message] : []),
    comment: '',
    tokens: 0,
    flags: []
  } : {
    id: characterId,
    name: '接続中...',
    role: CharacterType.PC,
    color: themeColor,
    secretHandout: '',
    handoutHistory: [],
    comment: '',
    tokens: 0,
    flags: []
  };

  return (
    <HandoutView 
      character={mockCharacter}
      scenarioTitle={data?.scenarioTitle || 'Secure Handout Channel'}
      themeColor={themeColor}
      onExit={() => {
        window.location.href = window.location.origin + window.location.pathname;
      }}
      isStandalone={true}
      onNotifyPresence={handleNotifyPresence}
      playerPresentAt={data?.playerPresentAt}
    />
  );
};

export default PlayerHandoutLoader;
