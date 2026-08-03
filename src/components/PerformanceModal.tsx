
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, MapPin, Users, History } from 'lucide-react';
import { Performance, Scenario } from '../types';

interface PerformanceModalProps {
  scenario: Scenario;
  phaseResults: Record<string, number>;
  onSave: (performance: Omit<Performance, 'id' | 'timestamp'>) => void;
  onClose: () => void;
  themeColor: string;
}

const PerformanceModal: React.FC<PerformanceModalProps> = ({ scenario, phaseResults, onSave, onClose, themeColor }) => {
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [cast, setCast] = useState(() => 
    scenario.characters.map(c => ({
      characterId: c.id,
      characterName: c.name,
      playerName: c.playerName || ''
    }))
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      date,
      venue,
      cast,
      phaseResults: { ...phaseResults },
      phases: scenario.phases ? [...scenario.phases] : []
    });
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <History size={20} style={{ color: themeColor }} />
            <h3 className="font-cinzel font-bold text-lg tracking-widest text-white">セッション履歴の記録</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          <div className="space-y-4">
             <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel">シナリオ</label>
                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/40 font-cinzel text-sm">
                   {scenario.title}
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
                     <Calendar size={12} /> 開催日
                   </label>
                   <input 
                     type="date"
                     value={date}
                     onChange={e => setDate(e.target.value)}
                     className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none focus:border-white/30"
                   />
                </div>
                <div className="flex flex-col gap-1.5">
                   <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
                     <MapPin size={12} /> 会場 / ツール
                   </label>
                   <input 
                     type="text"
                     value={venue}
                     onChange={e => setVenue(e.target.value)}
                     placeholder="例: Discord / 会場名など..."
                     className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white font-cinzel text-sm outline-none focus:border-white/30"
                   />
                </div>
             </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
              <Users size={12} /> 配役とプレイヤー名
            </label>
            <div className="space-y-2">
              {cast.map((member, idx) => (
                <div key={member.characterId} className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-white/20 font-cinzel uppercase">{member.characterName}</div>
                    <input 
                      type="text"
                      value={member.playerName}
                      onChange={e => {
                        const newCast = [...cast];
                        newCast[idx].playerName = e.target.value;
                        setCast(newCast);
                      }}
                      placeholder="プレイヤー名を入力..."
                      className="bg-transparent border-none p-0 text-white font-cinzel text-sm w-full outline-none placeholder:text-white/5"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        <div className="p-6 border-t border-white/5 flex gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-[12px] font-bold font-cinzel text-white/40 border border-white/10 hover:bg-white/5 transition-all"
          >
            キャンセル
          </button>
          <button 
            onClick={handleSubmit}
            style={{ backgroundColor: themeColor }}
            className="flex-2 py-3 rounded-xl text-[12px] font-bold font-cinzel text-white shadow-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Save size={16} /> 記録を保存
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
};

export default PerformanceModal;
