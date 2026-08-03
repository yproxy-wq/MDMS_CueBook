
import React from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';
import { INITIAL_SCENARIO } from '../../constants';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  version: string;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, themeColor, version }) => {
  if (typeof document === 'undefined' || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
          <div className="flex items-center gap-3">
            <BookOpen size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white uppercase">About CueBook</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12 scrollbar-thin">
          <div className="space-y-4">
            <h2 className="text-3xl font-cinzel font-bold text-white tracking-tight">{INITIAL_SCENARIO.title}</h2>
            <p className="text-white/40 text-[10px] tracking-widest uppercase flex items-center gap-2">
              Author: {INITIAL_SCENARIO.author} 
              <span className="w-1 h-1 rounded-full bg-white/20" /> 
              System: CueBook Engine {version}
            </p>
          </div>

          <div className="grid gap-8">
            {INITIAL_SCENARIO.phases.map((phase) => (
              <div key={phase.id} className="space-y-4 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <h4 className="text-sm font-cinzel font-bold text-white/90 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-[10px] font-mono" style={{ color: themeColor }}>
                    {phase.id.split('-').pop()?.toUpperCase() || 'P'}
                  </span>
                  {phase.name}
                </h4>
                {phase.description && (
                  <p className="text-xs text-white/40 leading-relaxed pl-11">
                    {phase.description}
                  </p>
                )}
                <div className="pl-11 space-y-4">
                  {phase.scriptBlocks?.map((block, idx) => (
                    <div key={idx} className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap font-sans">
                      {block.content}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
          <p className="text-[9px] font-cinzel text-white/20 tracking-widest uppercase">The Mastermind Deck / Narrative Intelligence System</p>
          <button 
            onClick={onClose}
            className="py-2 px-6 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-bold font-cinzel transition-all border border-white/10"
          >
            CLOSE
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default AboutModal;
