import React from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Music } from 'lucide-react';
import { Scenario } from '../../types';

interface PostSessionSummaryModalProps {
  scenario: Scenario;
  phaseDurations: Record<string, number>;
  usedSounds: Set<string>;
  onClose: () => void;
  themeColor: string;
}

const PostSessionSummaryModal: React.FC<PostSessionSummaryModalProps> = ({ 
  scenario, 
  phaseDurations, 
  usedSounds, 
  onClose, 
  themeColor 
}) => {
  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Clock size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white">SESSION SUMMARY</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
          {/* Phase Durations */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel">Phase Durations</label>
            <div className="space-y-2">
              {scenario.phases.map(phase => {
                const durationSeconds = phaseDurations[phase.id] || 0;
                const minutes = Math.floor(durationSeconds / 60);
                const seconds = Math.floor(durationSeconds % 60);
                return (
                  <div key={phase.id} className="flex justify-between bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <span className="text-sm text-white/80 font-sans">{phase.name}</span>
                    <span className="text-sm font-mono text-white/60">{minutes}m {seconds.toString().padStart(2, '0')}s</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Used Sounds */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
              <Music size={12} /> Used Sounds
            </label>
            <div className="flex flex-wrap gap-2">
              {Array.from(usedSounds).map(soundId => {
                const sound = scenario.sounds.find(s => s.id === soundId);
                return sound ? (
                  <span key={soundId} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white/70 font-sans">
                    {sound.name}
                  </span>
                ) : null;
              })}
              {usedSounds.size === 0 && <span className="text-sm text-white/20 italic">No sounds played.</span>}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 flex gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="w-full py-3 rounded-xl text-[12px] font-bold font-cinzel text-white/40 border border-white/10 hover:bg-white/5 transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default PostSessionSummaryModal;
