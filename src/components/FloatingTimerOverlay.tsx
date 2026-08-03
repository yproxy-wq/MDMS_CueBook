import React from 'react';
import { motion, MotionValue } from 'motion/react';
import TimerCard from './Timer';
import { TimerConfig, Phase } from '../types';

interface FloatingTimerOverlayProps {
  layoutMode: string;
  activeTimer: TimerConfig | undefined;
  activeTimerState: { seconds: number; isRunning: boolean; startTime?: number | null } | null;
  isMenuOpen: boolean;
  timerDocked: boolean;
  isSpecialExtendedLayout: boolean;
  timerRef: React.RefObject<HTMLDivElement | null>;
  dragConstraints: { left: number; right: number; top: number; bottom: number };
  timerX: number;
  timerY: number;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  themeColor: string;
  currentPhase: Phase | undefined;
  activeTimerIndex: number;
  user: unknown;
  timerLabelText?: string;
  timerFlashOnPauseEnabled?: boolean;
  getShareTimerUrl: () => string;
  onToggleTimer: (id?: string) => void;
  onResetTimer: (id?: string) => void;
  onAdjustTimer: (delta: number) => void;
  setShowSyncModal: (open: boolean) => void;
  setTimerDocked: (docked: boolean) => void;
  setActiveTimerIndex: React.Dispatch<React.SetStateAction<number>>;
  handleTimerDragStart: () => void;
  handleTimerDrag: (event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => void;
  handleTimerDragEnd: (event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number }; point: { x: number; y: number } }) => void;
}

export const FloatingTimerOverlay: React.FC<FloatingTimerOverlayProps> = React.memo(({
  layoutMode,
  activeTimer,
  activeTimerState,
  isMenuOpen,
  timerDocked,
  isSpecialExtendedLayout,
  timerRef,
  dragConstraints,
  timerX,
  timerY,
  dragX,
  dragY,
  themeColor,
  currentPhase,
  activeTimerIndex,
  user,
  timerLabelText,
  timerFlashOnPauseEnabled,
  getShareTimerUrl,
  onToggleTimer,
  onResetTimer,
  onAdjustTimer,
  setShowSyncModal,
  setTimerDocked,
  setActiveTimerIndex,
  handleTimerDragStart,
  handleTimerDrag,
  handleTimerDragEnd,
}) => {
  if (layoutMode === '1-column' || !activeTimer || !activeTimerState || isMenuOpen || (timerDocked && !isSpecialExtendedLayout)) {
    return null;
  }

  const timerCount = (currentPhase?.timers || []).length;

  return (
    <motion.div
      ref={timerRef}
      drag
      dragConstraints={dragConstraints}
      dragMomentum={false}
      dragElastic={0}
      whileDrag={{ scale: 1.03, zIndex: 120, boxShadow: '0 30px 60px rgba(0,0,0,0.8)' }}
      onDragStart={handleTimerDragStart}
      onDrag={handleTimerDrag}
      onDragEnd={handleTimerDragEnd}
      className="fixed z-[100] w-[200px] cursor-grab active:cursor-grabbing touch-none shadow-[0_20px_50px_rgba(0,0,0,0.6)] bg-zinc-950/90 border-2 border-white/45 rounded-2xl backdrop-blur-md overflow-visible transition-[box-shadow] duration-300"
      style={{
        left: timerX,
        top: timerY,
        x: dragX,
        y: dragY,
      }}
    >
      <TimerCard
        config={activeTimer}
        timerLabelText={timerLabelText}
        seconds={activeTimerState.seconds}
        isRunning={activeTimerState.isRunning}
        startTime={activeTimerState.startTime}
        themeColor={themeColor}
        totalTimers={timerCount}
        activeTimerIndex={activeTimerIndex}
        isCollapsed={false}
        isLoggedIn={!!user}
        onShare={getShareTimerUrl}
        onToggle={onToggleTimer}
        onReset={onResetTimer}
        onAdjust={onAdjustTimer}
        onOpenSyncModal={() => setShowSyncModal(true)}
        timerFlashOnPauseEnabled={timerFlashOnPauseEnabled}
        onSetDocked={setTimerDocked}
        onPrev={() => {
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev - 1 + timerCount) % timerCount);
          }
        }}
        onNext={() => {
          if (timerCount > 1) {
            setActiveTimerIndex(prev => (prev + 1) % timerCount);
          }
        }}
      />
    </motion.div>
  );
});

FloatingTimerOverlay.displayName = 'FloatingTimerOverlay';
