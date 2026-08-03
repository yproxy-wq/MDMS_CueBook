import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Share } from 'lucide-react';

interface SyncThumbProps {
  timerLabel: string | null;
  seconds: number;
  isRunning: boolean;
  startTime?: number | null;
  imageUrl: string | null;
  resourceType: 'image' | 'pdf' | null;
  pdfPage: number | null;
  themeColor: string;
  isClosed: boolean;
  onClose: () => void;
  onOpen: () => void;
  onOpenModal: () => void;
  isMobile: boolean;
}

const SyncThumb: React.FC<SyncThumbProps> = ({
  timerLabel,
  seconds,
  isRunning,
  startTime,
  imageUrl,
  resourceType,
  pdfPage,
  themeColor,
  isClosed,
  onClose,
  onOpen,
  onOpenModal,
  isMobile
}) => {
  const [displaySeconds, setDisplaySeconds] = React.useState(seconds);

  React.useEffect(() => {
    if (!isRunning || !startTime) {
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const remains = Math.max(0, seconds - elapsed);
      setDisplaySeconds(Math.ceil(remains));
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [isRunning, startTime, seconds]);

  // Keep displaySeconds in sync when not running
  React.useEffect(() => {
    if (!isRunning || !startTime) {
      setDisplaySeconds(seconds);
    }
  }, [isRunning, startTime, seconds]);

  const effectiveSeconds = isRunning && startTime ? displaySeconds : seconds;

  const formatTime = (s: number) => {
    const mins = Math.floor(Math.max(0, s) / 60);
    const secs = Math.floor(Math.max(0, s) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isMobile) {
    return (
      <div className="fixed bottom-6 right-6 z-[1000]">
        <button 
          onClick={onOpenModal}
          className="w-12 h-12 rounded-full bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <Share size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence mode="wait">
        {!isClosed ? (
          <motion.div
            key="thumb"
            drag
            dragMomentum={false}
            dragElastic={0.1}
            whileDrag={{ scale: 1.03 }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="w-48 aspect-video bg-zinc-900 rounded-xl border border-white/20 shadow-2xl overflow-hidden pointer-events-auto group relative cursor-grab active:cursor-grabbing touch-none"
          >
            {/* Background Image / PDF */}
            <div className="absolute inset-0 bg-black flex items-center justify-center">
              {imageUrl ? (
                 resourceType === 'pdf' ? (
                   <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1 opacity-40">
                         <Maximize2 size={24} className="text-sky-500" />
                         <span className="text-[8px] font-bold text-white uppercase tracking-widest">PDF: P{pdfPage}</span>
                      </div>
                   </div>
                 ) : (
                   imageUrl ? (
                     <img 
                      src={imageUrl} 
                      className="w-full h-full object-cover opacity-60" 
                      alt="Sync Preview" 
                      referrerPolicy="no-referrer"
                     />
                   ) : null
                 )
              ) : (
                <div className="w-full h-full opacity-10 blur-xl" style={{ backgroundColor: themeColor }} />
              )}
            </div>

            {/* Content Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-2 bg-gradient-to-t from-black/80 via-transparent to-transparent">
               <div className="mt-auto flex flex-col items-center">
                  <span className="text-[32px] font-mono font-black tabular-nums leading-none tracking-tighter text-white" style={{ textShadow: isRunning ? `0 0 10px ${themeColor}` : 'none' }}>
                    {formatTime(effectiveSeconds)}
                  </span>
                  <div className="flex items-center gap-1 opacity-40">
                    <div className="w-1 h-1 rounded-full" style={{ backgroundColor: themeColor }} />
                    <span className="text-[7px] font-bold font-cinzel text-white uppercase tracking-widest truncate max-w-[120px]">{timerLabel || 'TIMER'}</span>
                  </div>
               </div>
            </div>

            {/* Controls */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
               <button 
                onClick={onOpenModal}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-110"
                title="Open Sync Settings"
               >
                 <Share size={16} />
               </button>
            </div>

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white/40 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
            >
              <X size={14} />
            </button>

            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-500 text-[6px] font-bold tracking-widest font-cinzel">
              SYNCING
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={onOpen}
            className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 shadow-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-zinc-800 transition-all pointer-events-auto"
          >
            <Share size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SyncThumb;
