
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HelpTooltipProps {
  title: string;
  content: React.ReactNode;
  iconSize?: number;
}

export const HelpTooltip: React.FC<HelpTooltipProps> = ({ title, content, iconSize = 10 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left + rect.width / 2
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Listen to scroll and resize to keep tooltip pinned
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block ml-1">
      <button 
        ref={buttonRef}
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        className="p-0.5 text-white/20 hover:text-white/60 transition-colors focus:outline-none"
      >
        <HelpCircle size={iconSize} />
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 5 }}
              style={{ 
                position: 'fixed',
                top: coords.top - 12,
                left: coords.left,
                transform: 'translate(-50%, -100%)',
                zIndex: 9999
              }}
              className="w-48 p-3 bg-zinc-900 border border-white/20 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="text-[10px] font-black font-cinzel text-sky-400 mb-1.5 uppercase tracking-widest border-b border-white/10 pb-1 flex items-center gap-1.5">
                <Sparkles size={8} /> {title}
              </div>
              <div className="text-[9px] leading-relaxed text-white/70 font-medium whitespace-pre-wrap">
                {content}
              </div>
              <div 
                className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-[6px] border-transparent border-t-zinc-900 drop-shadow-md" 
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
