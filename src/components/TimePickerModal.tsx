
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTime: string;
  onSave: (time: string) => void;
  themeColor: string;
}

const TimePickerModal: React.FC<TimePickerModalProps> = ({ isOpen, onClose, initialTime, onSave, themeColor }) => {
  const [time, setTime] = React.useState(initialTime || '22:00');

  React.useEffect(() => {
    if (isOpen) {
      setTime(initialTime || '22:00');
    }
  }, [isOpen, initialTime]);

  if (!isOpen) return null;

  const [hours, minutes] = time.split(':').map(Number);

  const adjustTime = (hDelta: number, mDelta: number) => {
    let newH = (hours + hDelta + 24) % 24;
    let newM = (minutes + mDelta + 60) % 60;
    
    // Handle overflow if adding 15/30 mins
    if (mDelta !== 0) {
       const totalMins = hours * 60 + minutes + mDelta;
       newH = (Math.floor(totalMins / 60) + 24) % 24;
       newM = (totalMins % 60 + 60) % 60;
    }

    const hStr = newH.toString().padStart(2, '0');
    const mStr = newM.toString().padStart(2, '0');
    setTime(`${hStr}:${mStr}`);
  };

  const quickTimes = [
    { label: '+15m', dh: 0, dm: 15 },
    { label: '+30m', dh: 0, dm: 30 },
    { label: '+1h', dh: 1, dm: 0 },
    { label: '+2h', dh: 2, dm: 0 },
  ];

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white">SET EXIT TIME</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center gap-8">
          <div className="flex items-center gap-4">
             {/* Hours */}
             <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => adjustTime(1, 0)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                   <ChevronUp size={24} />
                </button>
                <div className="text-5xl font-mono font-black text-white px-4 py-2 bg-white/5 rounded-xl border border-white/10 w-24 text-center">
                   {hours.toString().padStart(2, '0')}
                </div>
                <button 
                  onClick={() => adjustTime(-1, 0)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                   <ChevronDown size={24} />
                </button>
             </div>

             <span className="text-4xl font-mono font-black text-white/20">:</span>

             {/* Minutes */}
             <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={() => adjustTime(0, 5)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                   <ChevronUp size={24} />
                </button>
                <div className="text-5xl font-mono font-black text-amber-500 px-4 py-2 bg-white/5 rounded-xl border border-white/10 w-24 text-center">
                   {minutes.toString().padStart(2, '0')}
                </div>
                <button 
                  onClick={() => adjustTime(0, -5)}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                >
                   <ChevronDown size={24} />
                </button>
             </div>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full">
             {quickTimes.map((qt) => (
               <button 
                 key={qt.label}
                 onClick={() => adjustTime(qt.dh, qt.dm)}
                 className="py-2.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold font-mono text-white/40 hover:text-white hover:bg-white/10 transition-all"
               >
                 {qt.label}
               </button>
             ))}
          </div>
        </div>

        <div className="p-6 border-t border-white/10 flex gap-4">
           <button 
             onClick={onClose}
             className="flex-1 py-3 rounded-xl border border-white/10 text-[10px] font-bold font-cinzel text-white/40 hover:bg-white/5 transition-all"
           >
             CANCEL
           </button>
           <button 
             onClick={() => { onSave(time); onClose(); }}
             style={{ backgroundColor: themeColor }}
             className="flex-1 py-3 rounded-xl text-[10px] font-bold font-cinzel text-white shadow-xl hover:brightness-110 active:scale-95 transition-all"
           >
             SET SCHEDULE
           </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default TimePickerModal;
