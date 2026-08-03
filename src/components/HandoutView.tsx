
import React from 'react';
import { Character } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Send, User, MessageCircle, ArrowLeft, MoreVertical, ShieldCheck, CheckCheck } from 'lucide-react';

interface HandoutViewProps {
  character: Character;
  scenarioTitle: string;
  themeColor: string;
  onExit: () => void;
  isStandalone?: boolean;
  onNotifyPresence?: () => void;
  playerPresentAt?: unknown;
}

const HandoutView: React.FC<HandoutViewProps> = ({ 
  character, scenarioTitle, onExit, isStandalone, onNotifyPresence, playerPresentAt 
}) => {
  const [showNotify, setShowNotify] = React.useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [character.handoutHistory]);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#0d0d0d] text-white flex flex-col animate-in fade-in duration-500 overflow-hidden font-sans">
      {/* Header (Message Top Bar Style) */}
      <header className="h-[72px] shrink-0 border-b border-white/5 px-4 flex items-center justify-between bg-zinc-900/80 backdrop-blur-3xl z-10">
        <div className="flex items-center gap-3">
          {!isStandalone ? (
            <button 
              onClick={onExit}
              className="p-2 text-white/40 hover:text-white transition-all"
            >
              <ArrowLeft size={24} />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-white/10 bg-white/5">
               <User size={20} className="text-white/40" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-1.5">
                <span className="font-bold text-[15px] tracking-tight truncate">{character.name || 'Connecting...'}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             </div>
             <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest truncate">{scenarioTitle || 'Secure Handout Channel'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden sm:flex flex-col items-end px-3 py-1 bg-white/5 rounded-lg border border-white/5 mr-2">
             <span className="text-[8px] font-black font-cinzel text-white/20 tracking-widest uppercase">Encryption</span>
             <span className="text-[9px] font-bold text-sky-400/60 font-mono">AES-256 E2EE</span>
          </div>
          <button className="p-2 text-white/20 hover:text-white transition-all">
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-thin bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"
      >
        
        {/* System Message */}
        <div className="flex justify-center">
           <div className="bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
              <ShieldCheck size={12} className="text-emerald-500/60" />
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">End-to-End Encrypted Session</span>
           </div>
        </div>

        {/* GM Info Message */}
        <div className="flex flex-col gap-1 max-w-[85%] md:max-w-[70%]">
           <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0">
                 <span className="text-[10px] font-black text-white/40">GM</span>
              </div>
              <div className="bg-zinc-800/80 border border-white/10 p-4 rounded-2xl rounded-bl-none shadow-xl">
                 <p className="text-sm leading-relaxed text-white/80">
                    プレイヤー接続を確認しました。これより個別の指示や情報を送信します。<br/>
                    この画面を開いたままお待ちください。
                 </p>
              </div>
           </div>
           <span className="text-[9px] font-bold text-white/10 ml-10">System · 12:00</span>
        </div>

        {/* Handout Messages Feed (GM to Player) */}
        {character.handoutHistory && character.handoutHistory.length > 0 ? (
          <div className="space-y-6">
            {character.handoutHistory.map((msg, idx) => (
              <div 
                key={idx} 
                className="flex flex-col gap-1 max-w-[90%] md:max-w-[80%] animate-in slide-in-from-left duration-500"
              >
                <div className="flex items-end gap-2 group">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                    <User size={16} className="text-white/40" />
                  </div>
                  <div className="bg-zinc-900 border border-white/10 p-5 rounded-3xl rounded-bl-none shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none">
                      <MessageCircle size={64} />
                    </div>
                    <div className="relative prose prose-invert prose-sm max-w-none">
                      <div className="markdown-body text-white/95 leading-relaxed font-sans text-[15px]">
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
                          {msg}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-10">
                  <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">{character.role || 'GM'}</span>
                  <span className="text-[8px] font-mono text-white/10">Transmission #{idx + 1}</span>
                </div>
              </div>
            ))}
            <div id="end-of-messages" />
          </div>
        ) : (
          <div className="flex justify-center p-12">
             <div className="flex flex-col items-center gap-4 opacity-20">
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/40 flex items-center justify-center animate-pulse">
                   <MessageCircle size={32} />
                </div>
                <p className="text-xs font-cinzel tracking-[0.2em] uppercase">Waiting for transmissions...</p>
             </div>
          </div>
        )}

        {/* Player Presence Status */}
        {playerPresentAt && (
          <div className="flex justify-end animate-in fade-in duration-700">
             <div className="flex flex-col items-end gap-1">
                <div className="bg-sky-500/20 border border-sky-500/30 px-4 py-2 rounded-2xl rounded-tr-none flex items-center gap-2">
                   <span className="text-xs font-medium text-sky-300">GMに接続完了を通知しました</span>
                   <CheckCheck size={14} className="text-sky-400" />
                </div>
                <span className="text-[9px] font-bold text-sky-500/40 uppercase tracking-widest">Sent</span>
             </div>
          </div>
        )}
      </div>

      {/* Action Bar / Input Mimic */}
      <footer className="p-4 md:p-6 bg-zinc-900/60 border-t border-white/5 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto">
          {(!playerPresentAt && showNotify) ? (
            <button 
              onClick={() => {
                onNotifyPresence?.();
                setShowNotify(false);
              }}
              className="w-full py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-bold font-cinzel text-xs flex items-center justify-center gap-3 shadow-2xl shadow-sky-900/40 transition-all active:scale-95 group"
            >
              <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              接続完了をGMに通知する
            </button>
          ) : (
            <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-2xl p-4">
              <div className="flex-1 text-sm text-white/30 font-medium">GMからのメッセージを待機中...</div>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <p className="text-[9px] text-white/10 text-center mt-4 tracking-[0.3em] font-cinzel uppercase">CueBook Individual Secure Transmission v2.4</p>
        </div>
      </footer>
    </div>
  );
};

export default HandoutView;
