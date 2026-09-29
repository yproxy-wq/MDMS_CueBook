import React, { useState, useEffect, useRef } from 'react';

interface HoldButtonProps {
  onHoldComplete: () => void;
  children: React.ReactNode;
  className?: string;
  requiredDuration?: number; // ms, default is 800ms
  title?: string;
  style?: React.CSSProperties;
  id?: string;
}

const getCurrentTime = () => Date.now();

export const HoldButton: React.FC<HoldButtonProps> = React.memo(({
  onHoldComplete,
  children,
  className = '',
  requiredDuration = 800,
  title,
  style,
  id
}) => {
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const pressingRef = useRef(false);
  const startTimeRef = useRef(0);
  const completeRef = useRef(onHoldComplete);
  useEffect(() => { completeRef.current = onHoldComplete; }, [onHoldComplete]);

  const endPress = () => {
    pressingRef.current = false;
    setIsPressing(false);
    setProgress(0);
    if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => {
    const cancel = () => {
      pressingRef.current = false;
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
      setIsPressing(false);
      setProgress(0);
    };
    const visibility = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
      pressingRef.current = false;
      if (timerRef.current !== null) cancelAnimationFrame(timerRef.current);
    };
  }, []);
  const startPress = () => {
    if (pressingRef.current) return;
    pressingRef.current = true;
    setIsPressing(true);
    setProgress(0);
    startTimeRef.current = getCurrentTime();
    const animate = () => {
      if (!pressingRef.current) return;
      const elapsed = getCurrentTime() - startTimeRef.current;
      setProgress(Math.min(100, elapsed / requiredDuration * 100));
      if (elapsed >= requiredDuration) {
        endPress();
        completeRef.current();
      } else timerRef.current = requestAnimationFrame(animate);
    };
    timerRef.current = requestAnimationFrame(animate);
  };

  return (
    <button
      id={id}
      type="button"
      aria-label={title}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        startPress();
      }}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onLostPointerCapture={endPress}
      onPointerLeave={endPress}
      onBlur={endPress}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); endPress(); }
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault(); event.stopPropagation();
          if (!event.repeat) startPress();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault(); event.stopPropagation(); endPress();
        }
      }}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); }}
      title={title}
      style={style}
      className={`relative min-h-[44px] min-w-[44px] touch-none overflow-hidden transition-all select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${className}`}
    >
      {/* Background fill based on progress */}
      {isPressing && (
        <span 
          className="absolute inset-0 bg-red-500/20 pointer-events-none origin-left transition-all duration-75"
          style={{ width: `${progress}%` }}
        />
      )}
      
      {/* Circular stroke indicator around the button is also possible, or full fill. 
          To keep it clean with diverse icon sizes, we show an elegant linear progress line at the bottom. */}
      {isPressing && (
        <span 
          className="absolute bottom-0 left-0 h-[3px] bg-red-500 transition-all duration-75"
          style={{ width: `${progress}%`, boxShadow: '0 0 8px #ef4444' }}
        />
      )}
      
      <span className="relative z-10 flex flex-col items-center justify-center">
        {children}
      </span>
    </button>
  );
});

HoldButton.displayName = 'HoldButton';
export default HoldButton;
