import React, { useState, useEffect, useRef } from 'react';
import { PenTool, X, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QuickNoteProps {
  scenarioId: string;
  themeColor?: string;
  position?: 'fixed' | 'absolute';
  posLabel?: 'top' | 'bottom';
}

export const QuickNote: React.FC<QuickNoteProps> = ({ 
  scenarioId, 
  themeColor = '#ef4444',
  position = 'fixed',
  posLabel = 'bottom'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [note, setNote] = useState(() => {
    return localStorage.getItem(`cuebook_quicknote_${scenarioId}`) || '';
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Debounced save helper to avoid CPU write spikes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(`cuebook_quicknote_${scenarioId}`, note);
    }, 400);
    return () => clearTimeout(timer);
  }, [note, scenarioId]);

  const handleClear = () => {
    if (window.confirm('メモ帳をクリアしますか？')) {
      setNote('');
    }
  };

  const outerClasses = position === 'fixed'
    ? "fixed bottom-48 left-6 z-[90] select-none pointer-events-none"
    : `absolute right-6 z-[110] select-none pointer-events-none ${
        posLabel === 'top' ? '-bottom-[25px]' : '-top-[25px]'
      }`;

  const buttonInnerClasses = "rounded-full flex items-center justify-center transition-all cursor-pointer shadow-[0_10px_30px_rgba(0,0,0,0.6)] backdrop-blur-md focus:outline-none";

  let padClasses = "absolute w-72 md:w-80 bg-zinc-950/95 border border-white/10 rounded-xl overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.9)] backdrop-blur-3xl pointer-events-auto";
  if (position === 'fixed') {
    padClasses += " bottom-16 left-0";
  } else {
    padClasses += posLabel === 'top' ? " top-12 right-0" : " bottom-12 right-0";
  }

  return (
    <div className={outerClasses}>
      {/* Floating Toggle Button */}
      <div className="pointer-events-auto">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className={buttonInnerClasses}
          style={{
            width: position === 'fixed' ? '48px' : '50px',
            height: position === 'fixed' ? '48px' : '50px',
            borderWidth: position === 'fixed' ? '1px' : '2px',
            backgroundColor: isOpen ? 'rgba(0,0,0,0.85)' : 'rgba(20,20,20,0.8)',
            borderColor: isOpen ? themeColor : 'rgba(255,255,255,0.15)',
            boxShadow: isOpen 
              ? `0 0 15px ${themeColor}40, 0 10px 30px rgba(0,0,0,0.6)` 
              : '0 0 0px transparent'
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="セッション一時メモ (Quick Note)"
        >
          <PenTool 
            size={position === 'fixed' ? 18 : 18} 
            style={{ color: isOpen ? themeColor : 'rgba(255,255,255,0.7)' }} 
            className="transition-transform duration-300"
          />
        </motion.button>
      </div>

      {/* Floating Pad Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: position === 'absolute' && posLabel === 'top' ? -15 : 15 }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0,
              height: isMinimized ? '40px' : '320px'
            }}
            exit={{ opacity: 0, scale: 0.9, y: position === 'absolute' && posLabel === 'top' ? -15 : 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={padClasses}
          >
            {/* Header */}
            <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between cursor-default shrink-0">
              <div className="flex items-center gap-1.5 font-cinzel text-[9px] font-black tracking-widest text-white/50">
                <PenTool size={10} style={{ color: themeColor }} />
                <span>QUICK NOTE</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Minimize/Maximize to take up less space */}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  title={isMinimized ? '広げる' : '折りたたむ'}
                >
                  {isMinimized ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
                </button>

                {/* Clear All Content */}
                {!isMinimized && (
                  <button
                    onClick={handleClear}
                    className="p-1 rounded text-white/20 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
                    title="クリア"
                  >
                    <Trash2 size={10} />
                  </button>
                )}

                {/* Close Pad */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  title="閉じる"
                >
                  <X size={10} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            {!isMinimized && (
              <div className="flex-1 p-3.5 flex flex-col bg-black/40">
                <textarea
                  ref={textareaRef}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="セッション中の出目や、一時的なメモ、NPCのアドリブ台詞など、卓固有の設定を自由に書き殴れます（自動保存されます）。"
                  className="flex-1 bg-transparent border-none p-0 text-white/85 text-[11.5px] leading-relaxed font-sans placeholder-white/20 focus:ring-0 focus:outline-none resize-none scrollbar-thin"
                />
                <div className="mt-2 flex items-center justify-between text-[8px] font-mono font-bold text-white/20 uppercase shrink-0 border-t border-white/5 pt-2">
                  <span>Scenario-Specific Pad</span>
                  <span>{note.length} CHARS</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
