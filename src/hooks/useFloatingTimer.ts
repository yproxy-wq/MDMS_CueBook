import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMotionValue } from 'motion/react';
import { parseCoordinate, constrainCoordinate, isNearDockPosition } from '../utils/coordinateHelper';

interface WindowSize {
  width: number;
  height: number;
}

export function useFloatingTimer(
  windowSize: WindowSize,
  isSpecialExtendedLayout: boolean,
  isEditorMode: boolean,
  isSoundboardCollapsed: boolean,
  layoutMode: string,
  timerDisplayPosition?: string
) {
  // Floating timer dragging and docking state (v0.86 UI optimization)
  const [timerDocked, setTimerDocked] = useState<boolean>(() => {
    const saved = localStorage.getItem('cuebook_timer_docked');
    return saved !== null ? saved === 'true' : false; // Default to false (floating!)
  });

  const [hasDraggedTimer, setHasDraggedTimer] = useState<boolean>(() => {
    return localStorage.getItem('cuebook_timer_has_dragged') === 'true';
  });

  const [timerX, setTimerX] = useState<number>(() => {
    const saved = localStorage.getItem('cuebook_timer_x');
    const defaultX = typeof window !== 'undefined' && window.innerWidth > 0 ? (window.innerWidth - 230) : 960;
    return parseCoordinate(saved, defaultX);
  });

  const [timerY, setTimerY] = useState<number>(() => {
    const saved = localStorage.getItem('cuebook_timer_y');
    return parseCoordinate(saved, 80);
  });

  const [isNearDock, setIsNearDock] = useState(false);
  const [dockCoords, setDockCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragConstraints, setDragConstraints] = useState<{ left: number; right: number; top: number; bottom: number }>({ left: 0, right: 0, top: 0, bottom: 0 });
  const timerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  // Detect if floating timer is dragged or placed out of visual bounds
  const isTimerOutOfWindow = useMemo(() => {
    if (timerDocked && !isSpecialExtendedLayout) return false;
    const timerW = 200;
    return (
      timerX < 5 ||
      timerY < 5 ||
      timerX > windowSize.width - timerW - 5 ||
      timerY > windowSize.height - 150
    );
  }, [timerX, timerY, timerDocked, isSpecialExtendedLayout, windowSize]);

  // Sync state variables to LocalStorage
  useEffect(() => {
    localStorage.setItem('cuebook_timer_docked', String(timerDocked));
  }, [timerDocked]);

  useEffect(() => {
    localStorage.setItem('cuebook_timer_x', String(timerX));
  }, [timerX]);

  useEffect(() => {
    localStorage.setItem('cuebook_timer_y', String(timerY));
  }, [timerY]);

  // Keep floating timer in bounds when window resize or layout modes change
  useEffect(() => {
    if (!timerDocked || isSpecialExtendedLayout) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimerX(prev => constrainCoordinate(prev, 10, windowSize.width - 100));
      setTimerY(prev => constrainCoordinate(prev, 10, windowSize.height - 100));
    }
  }, [timerDocked, isSpecialExtendedLayout, windowSize.width, windowSize.height]);

  // Keep floating/docked timers inside visual safe zones upon mount, resize, layout mode changes
  useEffect(() => {
    const showFloating = !timerDocked || isSpecialExtendedLayout;
    if (showFloating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimerX(prev => {
        if (prev <= 0 || prev >= windowSize.width) {
          return windowSize.width > 240 ? Math.max(10, windowSize.width - 230) : 10;
        }
        return constrainCoordinate(prev, 10, windowSize.width - 100);
      });
      setTimerY(prev => {
        if (prev <= 0 || prev >= windowSize.height) {
          return 80;
        }
        return constrainCoordinate(prev, 10, windowSize.height - 100);
      });
    }
  }, [timerDocked, isSpecialExtendedLayout, windowSize.width, windowSize.height]);

  // Read actual dock position dynamically
  const updateDockCoords = useCallback(() => {
    const el = document.getElementById('timer-dock-area');
    if (el) {
      const rect = el.getBoundingClientRect();
      setDockCoords({ x: rect.left, y: rect.top });
    }
  }, []);

  useEffect(() => {
    const r = setTimeout(updateDockCoords, 150);
    return () => clearTimeout(r);
  }, [updateDockCoords, isEditorMode, isSoundboardCollapsed, layoutMode, timerDisplayPosition]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateDockCoords();
  }, [updateDockCoords, windowSize.width, windowSize.height]);

  // Adjust coordinates if docked
  useEffect(() => {
    if (timerDocked && dockCoords && !isSpecialExtendedLayout) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimerX(dockCoords.x);
      setTimerY(dockCoords.y);
    }
  }, [timerDocked, dockCoords, isSpecialExtendedLayout]);

  // Adjust coordinates dynamically to match dock position as default if never dragged
  useEffect(() => {
    if (!hasDraggedTimer && dockCoords && !timerDocked && !isSpecialExtendedLayout) {
      if (isFinite(dockCoords.x) && isFinite(dockCoords.y)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTimerX(dockCoords.x);
        setTimerY(dockCoords.y);
      }
    }
  }, [hasDraggedTimer, dockCoords, timerDocked, isSpecialExtendedLayout]);

  const handleTimerDragStart = useCallback(() => {
    setHasDraggedTimer(true);
    localStorage.setItem('cuebook_timer_has_dragged', 'true');

    dragStartX.current = timerX;
    dragStartY.current = timerY;

    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const timerH = timerRef.current ? timerRef.current.offsetHeight : 113;
    const timerW = 200;
    const MARGIN = 10;

    setDragConstraints({
      left: -timerX + MARGIN,
      right: w - timerW - timerX - MARGIN,
      top: -timerY + MARGIN,
      bottom: h - timerH - timerY - MARGIN
    });
  }, [timerX, timerY]);

  const handleTimerDrag = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: { point: { x: number; y: number } }) => {
    if (!dockCoords) return;
    const isClose = isNearDockPosition(info.point.x, info.point.y, dockCoords.x, dockCoords.y, 200, 110);
    setIsNearDock(prev => (prev !== isClose ? isClose : prev));
  }, [dockCoords]);

  const handleTimerDragEnd = useCallback((_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number; y: number }; point: { x: number; y: number } }) => {
    const finalX = dragStartX.current + info.offset.x;
    const finalY = dragStartY.current + info.offset.y;

    if (dockCoords && isNearDockPosition(info.point.x, info.point.y, dockCoords.x, dockCoords.y, 200, 110)) {
      setTimerDocked(true);
      setIsNearDock(false);
      setTimerX(dockCoords.x);
      setTimerY(dockCoords.y);
    } else {
      setTimerDocked(false);
      setIsNearDock(false);
      const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const h = typeof window !== 'undefined' ? window.innerHeight : 800;
      setTimerX(constrainCoordinate(finalX, 10, w - 100));
      setTimerY(constrainCoordinate(finalY, 10, h - 100));
    }

    dragX.set(0);
    dragY.set(0);
  }, [dockCoords, dragX, dragY]);

  const resetTimerPosition = useCallback(() => {
    setTimerDocked(false);
    setIsNearDock(false);
    setHasDraggedTimer(false);
    localStorage.removeItem('cuebook_timer_has_dragged');

    if (dockCoords && isFinite(dockCoords.x) && isFinite(dockCoords.y)) {
      setTimerX(dockCoords.x);
      setTimerY(dockCoords.y);
    } else {
      const defaultX = typeof window !== 'undefined' && window.innerWidth > 0 ? (window.innerWidth - 230) : 960;
      setTimerX(defaultX);
      setTimerY(80);
    }

    dragX.set(0);
    dragY.set(0);
  }, [dockCoords, dragX, dragY]);

  return {
    timerDocked,
    setTimerDocked,
    hasDraggedTimer,
    timerX,
    setTimerX,
    timerY,
    setTimerY,
    isNearDock,
    dockCoords,
    dragConstraints,
    timerRef,
    dragX,
    dragY,
    isTimerOutOfWindow,
    updateDockCoords,
    handleTimerDragStart,
    handleTimerDrag,
    handleTimerDragEnd,
    resetTimerPosition,
  };
}
