
import React, { useState, useEffect, useRef } from 'react';
import { Palette, X, Check } from 'lucide-react';

const PRESET_COLORS = [
  '#ef4444', '#f87171', '#dc2626', '#991b1b', // Reds
  '#ec4899', '#f472b6', '#db2777', '#9d174d', // Pinks
  '#a855f7', '#c084fc', '#9333ea', '#6b21a8', // Purples
  '#6366f1', '#818cf8', '#4f46e5', '#3730a3', // Indigos
  '#3b82f6', '#60a5fa', '#2563eb', '#1e40af', // Blues
  '#06b6d4', '#22d3ee', '#0891b2', '#155e75', // Cyans
  '#10b981', '#34d399', '#059669', '#065f46', // Greens
  '#eab308', '#facc15', '#ca8a04', '#854d0e', // Yellows
  '#f97316', '#fb923c', '#ea580c', '#9a3412', // Oranges
  '#71717a', '#a1a1aa', '#52525b', '#27272a', // Zinc/Greys
];

interface ColorPickerProps {
  value: string;
  onChange: (val: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="max-w-full flex items-center gap-3 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl hover:border-white/30 transition-all group"
      >
        <div className="w-5 h-5 rounded shadow-sm border border-white/10" style={{ backgroundColor: value }} />
        <span className="text-xs font-mono text-white/60 group-hover:text-white transition-colors">{value.toUpperCase()}</span>
        <Palette size={14} className="text-white/20 group-hover:text-white/60 transition-colors" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-[9999] w-64 p-4 bg-zinc-900 border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold font-cinzel text-white/40 tracking-widest uppercase">Select Color</span>
            <button onClick={() => setIsOpen(false)} className="text-white/20 hover:text-white transition-colors"><X size={14}/></button>
          </div>
          
          <div className="grid grid-cols-8 gap-1.5 mb-4">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => {
                  onChange(color);
                }}
                className="w-full aspect-square rounded-md transition-all hover:scale-125 active:scale-90 flex items-center justify-center relative group"
                style={{ backgroundColor: color }}
              >
                {value.toLowerCase() === color.toLowerCase() && (
                  <Check size={10} className="text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                )}
                <div className="absolute inset-0 border border-white/10 rounded-md pointer-events-none" />
              </button>
            ))}
          </div>

          <div className="space-y-3 pt-3 border-t border-white/5">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-mono text-white/20 uppercase font-black">HEX</span>
              <input
                value={inputValue || ''}
                onChange={handleInputChange}
                placeholder="#FFFFFF"
                className="w-full bg-black/60 border border-white/10 rounded-xl py-2 pl-10 pr-3 text-xs font-mono text-white/80 outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
