
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Info } from 'lucide-react';

interface UpdateLog {
  date: string;
  version: string;
  notes: string[];
}

interface UpdateLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeColor: string;
  updateLogs: UpdateLog[];
}

const UpdateLogModal: React.FC<UpdateLogModalProps> = ({ isOpen, onClose, themeColor, updateLogs }) => {
  if (typeof document === 'undefined' || !isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 top-0 left-0 w-full h-full flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300 z-[99999]"
      style={{ position: 'fixed' }}
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Info size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white">UPDATE LOGS</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/20 hover:text-white transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin">
          {updateLogs.map((log) => (
            <div key={log.version} className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-xl font-cinzel font-bold" style={{ color: themeColor }}>{log.version}</span>
                <span className="text-[10px] font-mono text-white/20">{log.date}</span>
              </div>
              <ul className="space-y-2">
                {log.notes.map((note, idx) => (
                  <li key={idx} className="flex gap-3 text-[12px] leading-relaxed text-white/60 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: themeColor }} />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="p-6 border-t border-white/5 bg-white/[0.02] text-center shrink-0">
          <p className="text-[9px] font-cinzel text-white/20 tracking-widest uppercase">Thank you for using CueBook Beta</p>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default UpdateLogModal;
