import React from 'react';
import { createPortal } from 'react-dom';
import { X, Share2, Copy, Check, ExternalLink, MessageCircle, Send, AlertTriangle, RotateCcw, Loader2, HelpCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Character } from '../types';
import { syncService } from '../services/SyncService';
import { createHandoutSessionId, isSecureShareId } from '../utils/syncHelper';

interface HandoutModalProps {
  character: Character;
  onClose: () => void;
  themeColor: string;
  onUpdateCharacter?: (charId: string, updates: Partial<Character>) => void;
  sessionId?: string;
  scenarioTitle: string;
}

const HandoutModal: React.FC<HandoutModalProps> = ({ character, onClose, themeColor, onUpdateCharacter, sessionId, scenarioTitle }) => {
  const [copied, setCopied] = React.useState(false);
  const [showUrlHelp, setShowUrlHelp] = React.useState(false);
  const [message, setMessage] = React.useState(character.secretHandout || '');
  const [isSending, setIsSending] = React.useState(false);
  const [playerStatus, setPlayerStatus] = React.useState<{ present: boolean; lastSeen?: unknown } | null>(null);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fullSessionId = React.useMemo(() => (
    sessionId && isSecureShareId(character.handoutShareId)
      ? createHandoutSessionId(sessionId, character.handoutShareId)
      : undefined
  ), [sessionId, character.handoutShareId]);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [character.handoutHistory, message]);
  
  const handoutUrl = React.useMemo(() => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('cid', character.id);
    if (fullSessionId) {
      url.searchParams.set('sid', fullSessionId);
    }
    return url.toString();
  }, [character.id, fullSessionId]);

  // Subscribe to handout doc to see player presence and verify sync
  React.useEffect(() => {
    if (fullSessionId) {
      const unsubscribe = syncService.subscribeToHandout(fullSessionId, (data) => {
        if (data && data.playerPresentAt) {
          setPlayerStatus({ present: true, lastSeen: data.playerPresentAt });
        } else {
          setPlayerStatus(null);
        }
        
        setIsInitialized(true);
        setSyncError(null);
      }, (err) => {
        console.error("Handout sync error:", err);
        setSyncError("Firestoreとの同期に失敗しました（権限エラーの可能性があります）");
      });
      
      // Auto-initialize handout structure if it doesn't exist
      // Use a local variable to prevent redundant initialization in the same effect execution
      let hasAttemptedInit = false;
      const initHandout = async () => {
        if (hasAttemptedInit) return;
        hasAttemptedInit = true;
        try {
          await syncService.updateHandout(fullSessionId, {
            characterId: character.id,
            characterName: character.name,
            characterRole: character.role,
            characterColor: character.color,
            scenarioTitle: scenarioTitle
          });
        } catch (err) {
          console.error("Failed to initialize handout:", err);
          setSyncError("初期化に失敗しました。ログイン状態を確認してください。");
        }
      };
      initHandout();

      return () => {
        unsubscribe();
      };
    } else {
      setSyncError("セッションIDが見つかりません。GMとしてログインしているか確認してください。");
    }
  }, [fullSessionId, character.id, character.name, character.role, character.color, scenarioTitle]);

  const handleCopy = () => {
    navigator.clipboard.writeText(handoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 9000);
  };

  const handleSend = async () => {
    if (onUpdateCharacter && message.trim()) {
      setIsSending(true);
      setSyncError(null);
      const messageToSend = message.trim();
      
      try {
        // Sync to Firebase if sessionId is present
        if (fullSessionId) {
          await syncService.sendHandoutMessage(fullSessionId, messageToSend);
          
          // Update local handout history for persistence in scenario data
          const newHistory = [...(character.handoutHistory || [])];
          newHistory.push(messageToSend);
          
          onUpdateCharacter(character.id, { 
            secretHandout: messageToSend,
            handoutHistory: newHistory
          });

          // Clear message after sending
          setMessage('');
        } else {
          throw new Error("Missing Session ID");
        }
      } catch (err) {
        console.error("Handout send failed:", err);
        setSyncError("送信に失敗しました。ネットワークまたは権限の問題の可能性があります。");
      } finally {
        setTimeout(() => setIsSending(false), 800);
      }
    }
  };

  const handleClearHistory = async () => {
    if (!onUpdateCharacter || !fullSessionId) return;
    if (!window.confirm("このプレイヤーへの送信履歴をすべて削除しますか？\n(クラウド上のデータもリセットされます)")) return;

    try {
      await syncService.clearHandoutMessages(fullSessionId);
      
      onUpdateCharacter(character.id, { 
        secretHandout: "",
        handoutHistory: []
      });
    } catch (err) {
      console.error("Clear history failed:", err);
      setSyncError("履歴の削除に失敗しました。");
    }
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="bg-[#121212] border border-white/10 rounded-[32px] w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/[0.02]">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] font-cinzel">Individual Notification Panel</span>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: character.color }} />
              <h3 className="font-cinzel font-bold text-2xl tracking-widest text-white truncate max-w-[280px] md:max-w-[400px]">{character.name}</h3>
              {playerStatus?.present ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full animate-in fade-in slide-in-from-left-2 transition-all">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[9px] font-black font-cinzel text-emerald-500 uppercase tracking-widest">Player Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full opacity-40">
                   <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                   <span className="text-[9px] font-black font-cinzel text-white/40 uppercase tracking-widest">Player Offline</span>
                </div>
              )}
              {isInitialized ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                   <span className="text-[9px] font-black font-cinzel text-blue-500/60 uppercase tracking-widest">Sync Active</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full animate-pulse">
                   <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                   <span className="text-[9px] font-black font-cinzel text-yellow-500 uppercase tracking-widest">Connecting...</span>
                </div>
              )}
            </div>
          </div>
          
          <AnimatePresence>
            {playerStatus?.present && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                className="absolute right-24 top-6 bg-emerald-500 text-white px-4 py-2 rounded-2xl rounded-br-none shadow-xl text-[10px] font-bold font-sans flex items-center gap-2 z-20 pointer-events-none"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Player has joined!
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-3">
            {character.handoutHistory && character.handoutHistory.length > 0 && (
              <button 
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all font-cinzel font-bold text-[10px] tracking-widest shrink-0"
              >
                <RotateCcw size={14} />
                CLEAR LOG
              </button>
            )}
            <button onClick={onClose} className="text-white/20 hover:text-white transition-all p-3 bg-white/5 hover:bg-white/10 rounded-full shrink-0">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col md:flex-row">
          
          {/* Left Panel: Messaging & History (Messaging app Style) */}
          <div className="flex-1 p-0 border-b md:border-b-0 md:border-r border-white/5 flex flex-col bg-zinc-900/20">
            {/* Notification Bar */}
            {syncError && (
              <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle className="text-red-500 shrink-0" size={14} />
                <p className="text-[10px] text-red-200/80 font-medium">{syncError}</p>
              </div>
            )}

            {/* Message Feed Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin flex flex-col justify-end"
            >
              <div className="flex flex-col gap-6">
                {/* History bubbles */}
                {character.handoutHistory && character.handoutHistory.length > 0 && character.handoutHistory.map((histMessage, i) => (
                  <div key={i} className="flex flex-col items-end gap-1 group animate-in slide-in-from-right-2 duration-300">
                    <div className="max-w-[85%] bg-zinc-800 border border-white/10 px-5 py-3 rounded-3xl rounded-tr-none text-white/90 text-sm leading-relaxed group relative shadow-lg">
                      <div className="markdown-body prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            a: ({ ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sky-400 underline underline-offset-4 hover:text-sky-300 transition-colors" 
                              />
                            )
                          }}
                        >
                          {histMessage}
                        </ReactMarkdown>
                      </div>
                      <button 
                        onClick={() => setMessage(histMessage)}
                        className="absolute -left-12 top-1/2 -translate-y-1/2 p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/20 hover:text-white opacity-0 group-hover:opacity-100 transition-all border border-white/5"
                        title="Reuse this message"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mr-1">
                      <span className="text-[8px] font-mono opacity-20">SEQ #{i + 1}</span>
                      <div className="flex items-center gap-1 opacity-25">
                        <Check size={10} className="text-sky-400" />
                        <span className="text-[8px] font-bold uppercase tracking-widest">Delivered</span>
                      </div>
                    </div>
                  </div>
                ))}

                {(!character.handoutHistory || character.handoutHistory.length === 0) && !message.trim() && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-10">
                     <MessageCircle size={64} strokeWidth={1} />
                     <p className="text-[10px] font-cinzel tracking-[0.4em] mt-6 uppercase">Secure Protocol Initialized</p>
                  </div>
                )}
                
                {/* Draft preview if user is typing */}
                {message.trim() && (
                  <div className="flex flex-col items-end gap-1 group animate-in slide-in-from-right-2 duration-300 opacity-50">
                    <div 
                      className="max-w-[85%] px-5 py-3 rounded-3xl rounded-tr-none text-white text-sm leading-relaxed shadow-xl border border-white/10"
                      style={{ backgroundColor: themeColor }}
                    >
                      <div className="markdown-body prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            a: ({ ...props }) => (
                              <a 
                                {...props} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-white underline underline-offset-4" 
                              />
                            )
                          }}
                        >
                          {message}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mr-1">Drafting...</span>
                  </div>
                )}
              </div>
            </div>

            {/* System Info Bubble (Player Presence) */}
            {playerStatus?.present && (
              <div className="flex justify-center p-4">
                 <div className="px-4 py-1.5 bg-emerald-500/5 border border-emerald-500/10 rounded-full flex items-center gap-2">
                    <Check size={12} className="text-emerald-500/80" />
                    <span className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-widest">Player is monitoring this channel</span>
                 </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="p-4 md:p-6 bg-black/40 border-t border-white/5">
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="プレイヤーに送る内容を入力... (Markdown対応)"
                    className="w-full h-24 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white/90 font-sans resize-none focus:border-white/20 transition-all outline-none scrollbar-thin shadow-inner leading-relaxed"
                  />
                  <div className="absolute bottom-2 right-4 text-[9px] font-mono text-white/10">
                    {message.length} chars
                  </div>
                </div>
                <button 
                   onClick={handleSend}
                   disabled={!message.trim() || isSending}
                   style={{ backgroundColor: isSending ? undefined : themeColor }}
                   className={`w-full py-3 rounded-xl text-white font-bold font-cinzel text-[10px] shadow-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isSending ? 'bg-emerald-500/20 text-emerald-400' : 'hover:brightness-110 active:scale-95'}`}
                >
                   {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                   {isSending ? "SYNCING..." : "この内容を受信箱に送信"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Access & Sharing */}
          <div className="w-full md:w-[320px] p-6 md:p-8 bg-white/[0.01] flex flex-col gap-8 shrink-0">
            <div className="flex flex-col items-center gap-8">
              <div className="space-y-3 w-full">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest font-cinzel text-center block">Player Access QR</label>
                <div className="p-5 bg-white rounded-[28px] shadow-[0_0_60px_rgba(255,255,255,0.05)] mx-auto w-fit transition-transform hover:scale-105 duration-500">
                  <QRCodeSVG 
                    value={handoutUrl} 
                    size={180}
                    level="H"
                    fgColor="#000000"
                  />
                </div>
              </div>
              
              <div className="w-full space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest font-cinzel text-center block">Direct Access Link</label>
                    <button 
                      onClick={() => setShowUrlHelp(!showUrlHelp)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition-all border ${
                        showUrlHelp 
                          ? 'bg-sky-500 text-white border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.5)]' 
                          : 'bg-sky-500/10 text-sky-500 border-sky-500/30 hover:bg-sky-500/20'
                      }`}
                      title="URLについての説明"
                    >
                      <HelpCircle size={12} strokeWidth={3} />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showUrlHelp && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-sky-500/5 border border-sky-500/10 rounded-xl p-3 overflow-hidden mb-2"
                      >
                        <p className="text-[9px] text-sky-400/80 font-medium leading-relaxed text-center">
                          この個別メッセージ用ＵＲＬは固定で、変わりません。シナリオＩＤ、あなたの固有ＩＤ、そしてキャラクターＩＤで決まります。
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-2 pl-4">
                    <span className="text-[9px] font-mono text-white/30 truncate flex-1">
                      {handoutUrl}
                    </span>
                    <button 
                      onClick={handleCopy}
                      className={`p-2 rounded-lg transition-all shrink-0 ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40 hover:text-white'}`}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => window.open(handoutUrl, '_blank')}
                    className="py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold font-cinzel text-[10px] flex items-center justify-center gap-2 hover:bg-white/10 transition-all hover:text-white group"
                  >
                    <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" /> 
                    PLAYER PREVIEW
                  </button>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: `Individual: ${character.name}`, url: handoutUrl });
                      } else { handleCopy(); }
                    }}
                    className="py-3 px-4 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 font-bold font-cinzel text-[10px] flex items-center justify-center gap-2 hover:bg-sky-500/20 transition-all"
                  >
                    <Share2 size={14} /> SHARE TO PLAYER
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto space-y-4">
              <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl space-y-3">
                <h4 className="text-[9px] font-bold font-cinzel text-white/40 tracking-[0.2em] uppercase">Usage Hint</h4>
                <p className="text-[10px] text-white/20 leading-relaxed font-sans italic">
                  プレイヤーは上記リンクから自分専用のメッセージを確認できます。<br/><br/>
                  GMが内容を更新すると、プレイヤー側の画面も自動的に反映されます。口頭で伝えにくい秘密情報や、一時的なステータス変化の通知に最適です。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default HandoutModal;
