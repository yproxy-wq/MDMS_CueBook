
import React from 'react';
import { Scenario, Character, CharacterType } from '../../types';
import { Users, UserPlus, UserCircle, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { ColorPicker } from './ColorPicker';

const PRESET_COLORS = [
  '#ef4444', '#f87171', '#dc2626', '#991b1b',
  '#ec4899', '#f472b6', '#db2777', '#9d174d',
  '#a855f7', '#c084fc', '#9333ea', '#6b21a8',
  '#6366f1', '#818cf8', '#4f46e5', '#3730a3',
  '#3b82f6', '#60a5fa', '#2563eb', '#1e40af',
  '#06b6d4', '#22d3ee', '#0891b2', '#155e75',
  '#10b981', '#34d399', '#059669', '#065f46',
  '#eab308', '#facc15', '#ca8a04', '#854d0e',
  '#f97316', '#fb923c', '#ea580c', '#9a3412',
  '#71717a', '#a1a1aa', '#52525b', '#27272a',
];

interface CharactersTabProps {
  scenario: Scenario;
  onUpdate: (updates: Partial<Scenario>) => void;
}

export const CharactersTab: React.FC<CharactersTabProps> = React.memo(({ scenario, onUpdate }) => {
  const characters = scenario.characters || [];

  const updateCharacter = (charId: string, updates: Partial<Character>) => {
    onUpdate({
      characters: characters.map(c => c.id === charId ? { ...c, ...updates } : c)
    });
  };

  const addCharacter = () => {
    const usedColors = characters.map(c => c.color?.toLowerCase()).filter(Boolean);
    const availableColors = PRESET_COLORS.filter(c => !usedColors.includes(c.toLowerCase()));
    const chosenColor = availableColors.length > 0 
      ? availableColors[Math.floor(Math.random() * availableColors.length)] 
      : PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    
    onUpdate({
      characters: [
        ...characters, 
        {
          id: `c-${Date.now()}`, 
          name: '新キャラクター', 
          role: CharacterType.PC, 
          comment: '', 
          color: chosenColor, 
          tokens: 0, 
          flags: [false, false, false],
          playerName: ''
        }
      ]
    });
  };

  const moveCharacter = (idx: number, dir: 'up' | 'down') => {
    const next = [...characters];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onUpdate({ characters: next });
  };

  const removeCharacter = (id: string) => {
    onUpdate({
      characters: characters.filter(c => c.id !== id)
    });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-cinzel font-bold text-white/40 uppercase tracking-[0.3em] flex items-center gap-3">
          <Users size={24} /> 登場人物管理
        </h3>
        <button 
          onClick={addCharacter} 
          className="px-6 py-3 bg-zinc-900 border border-white/10 rounded-xl text-[11px] font-bold font-cinzel text-white/80 hover:text-white transition-all shadow-xl flex items-center gap-2"
        >
          <UserPlus size={16} /> キャラクター追加
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {characters.map((char, idx) => (
          <div key={char.id} className="p-5 bg-zinc-900/60 border border-white/5 rounded-2xl flex flex-col gap-4 group transition-all hover:border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <button 
                    onClick={() => moveCharacter(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-white/10 hover:text-white disabled:opacity-0 transition-all"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button 
                    onClick={() => moveCharacter(idx, 'down')}
                    disabled={idx === characters.length - 1}
                    className="p-1 text-white/10 hover:text-white disabled:opacity-0 transition-all"
                  >
                    <ArrowDown size={14} />
                  </button>
                </div>
                <UserCircle size={44} style={{ color: char.color }} className="drop-shadow-lg" />
              </div>
              <div className="flex-1 space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                  <input 
                    value={char.name || ''} 
                    onChange={e => updateCharacter(char.id, {name: e.target.value})} 
                    className="flex-1 min-w-0 bg-transparent border-none p-0 text-lg font-bold text-white outline-none" 
                    placeholder="キャラクター名" 
                  />
                  <button 
                    onClick={() => removeCharacter(char.id)} 
                    className="p-2 text-white/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <select 
                    value={char.role} 
                    onChange={e => updateCharacter(char.id, {role: e.target.value as CharacterType})} 
                    className="max-w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold font-cinzel text-white/60 outline-none"
                  >
                    <option value={CharacterType.PC}>Player Character</option>
                    <option value={CharacterType.NPC}>NPC / Master</option>
                  </select>
                  <ColorPicker 
                    value={char.color || '#ffffff'} 
                    onChange={val => updateCharacter(char.id, {color: val})} 
                  />
                </div>
              </div>
            </div>
            <textarea 
              value={char.comment || ''} 
              onChange={e => updateCharacter(char.id, {comment: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] text-white/60 h-20 outline-none resize-none focus:border-white/30" 
              placeholder="公開プロフィールやGMメモ..." 
            />
          </div>
        ))}
      </div>
    </div>
  );
});
