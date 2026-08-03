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
  const startTimeRef = useRef<number>(0);
  const isTouchActiveRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();

    const isTouchEvent = 'touches' in e;
    if (isTouchEvent) {
      isTouchActiveRef.current = true;
    } else if (isTouchActiveRef.current) {
      // Ignore mouse event if a touch event is active (prevents synthetic mouse events on mobile)
      return;
    }

    // Cancel any existing animation before starting a new one
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }

    setIsPressing(true);
    setProgress(0);
    startTimeRef.current = getCurrentTime();

    const animate = () => {
      const elapsed = getCurrentTime() - startTimeRef.current;
      const currentProgress = Math.min(100, (elapsed / requiredDuration) * 100);
      setProgress(currentProgress);

      if (elapsed >= requiredDuration) {
        onHoldComplete();
        endPress();
      } else {
        timerRef.current = requestAnimationFrame(animate);
      }
    };

    timerRef.current = requestAnimationFrame(animate);
  };

  const endPress = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      const isTouchEvent = 'touches' in e;
      if (isTouchEvent) {
        // Keep active brief to suppress synthetic clicks/mousedowns on mobile
        setTimeout(() => {
          isTouchActiveRef.current = false;
        }, 300);
      }
    }

    setIsPressing(false);
    setProgress(0);
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <button
      id={id}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      title={title}
      style={style}
      className={`relative overflow-hidden transition-all select-none ${className}`}
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
