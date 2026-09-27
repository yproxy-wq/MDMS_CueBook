import React from 'react';
import { Phase } from '../types';
interface PhaseCardProps {
  phase: Phase;
  index: number;
  isActive: boolean;
  isPreview: boolean;
  unlocked: boolean;
  themeColor: string;
  runningSeconds: number;
  timerState?: {
    seconds: number;
    isRunning: boolean;
    startTime?: number | null;
  };
  onPreview: (id: string) => void;
  onActivate: (id: string) => void;
  onToggleTimer: (id: string) => void;
  onSetCompleted: (id: string, completed: boolean) => void;
  onOpenDetails: () => void;
  onResetTimer?: (id: string) => void;
}

// Lifecycle controls are frozen; tabs only select the script.
export const PhaseCard: React.FC<PhaseCardProps> = React.memo(({ phase, index, isPreview, themeColor, onPreview }) => (
  <button type="button" aria-pressed={isPreview} onClick={() => onPreview(phase.id)}
    className={`phase-tab shrink-0 rounded-xl border px-3 py-2 text-left font-sans transition-colors ${isPreview ? 'bg-white/10 text-white' : 'bg-zinc-950 text-white/75 hover:bg-white/5'}`}
    style={{ borderColor: isPreview ? (phase.themeColor || themeColor) : '#ffffff26' }}>
    <span className="block text-[11px] font-mono text-white/50">{String(index + 1).padStart(2, '0')}</span>
    <span className="block whitespace-normal leading-snug">{phase.name}</span>
  </button>
));
export default PhaseCard;
