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
    return parseCoordinate(saved, 160);
  });

  const [isNearDock, setIsNearDock] = useState(false);
  const [dockCoords, setDockCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragConstraints, setDragConstraints] = useState<{ left: number; right: number; top: number; bottom: number }>({ left: 0, right: 0, top: 0, bottom: 0 });
  const timerRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number>(0);
  const dragStartY = useRef<number>(0);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const [panelSize, setPanelSize] = useState({ width: 280, height: 220 });
  // Include the control row in the panel's measured dimensions, without polling.
  useEffect(() => {
    const panel = timerRef.current;
    if (!panel) return;
    const measure = () => {
      const rect = panel.getBoundingClientRect();
      if (rect.width && rect.height) setPanelSize(previous => previous.width === rect.width && previous.height === rect.height ? previous : { width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  });
  const safePosition = useCallback((x: number, y: number) => ({
    x: constrainCoordinate(x, 10, Math.max(10, windowSize.width - panelSize.width - 10)),
    y: constrainCoordinate(y, 10, Math.max(10, windowSize.height - panelSize.height - 10)),
  }), [windowSize.width, windowSize.height, panelSize]);

  // Detect if floating timer is dragged or placed out of visual bounds
  const isTimerOutOfWindow = useMemo(() => {
    if (timerDocked && !isSpecialExtendedLayout) return false;
    const timerW = panelSize.width;
    return (
      timerX < 5 ||
      timerY < 5 ||
      timerX > windowSize.width - timerW - 5 ||
      timerY > windowSize.height - panelSize.height - 5
    );
  }, [timerX, timerY, timerDocked, isSpecialExtendedLayout, windowSize, panelSize]);

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

  // One clamp handles restored coordinates, rotations, layout changes and resizing.
  useEffect(() => {
    if (timerDocked && !isSpecialExtendedLayout) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimerX(previous => safePosition(previous, 0).x);
    setTimerY(previous => safePosition(0, hasDraggedTimer ? previous : Math.max(160, previous)).y);
  }, [timerDocked, isSpecialExtendedLayout, safePosition, hasDraggedTimer]);

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
      setTimerX(safePosition(dockCoords.x, dockCoords.y).x);
      setTimerY(safePosition(dockCoords.x, dockCoords.y).y);
    }
  }, [timerDocked, dockCoords, isSpecialExtendedLayout, safePosition]);

  // Adjust coordinates dynamically to match dock position as default if never dragged
  useEffect(() => {
    if (!hasDraggedTimer && dockCoords && !timerDocked && !isSpecialExtendedLayout) {
      if (isFinite(dockCoords.x) && isFinite(dockCoords.y)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTimerX(safePosition(dockCoords.x, dockCoords.y).x);
        setTimerY(safePosition(dockCoords.x, Math.max(160, dockCoords.y)).y);
      }
    }
  }, [hasDraggedTimer, dockCoords, timerDocked, isSpecialExtendedLayout, safePosition]);

  const handleTimerDragStart = useCallback(() => {
    setHasDraggedTimer(true);
    localStorage.setItem('cuebook_timer_has_dragged', 'true');

    dragStartX.current = timerX;
    dragStartY.current = timerY;

    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    const timerH = panelSize.height;
    const timerW = panelSize.width;
    const MARGIN = 10;

    setDragConstraints({
      left: -timerX + MARGIN,
      right: Math.max(MARGIN, w - timerW - MARGIN) - timerX,
      top: -timerY + MARGIN,
      bottom: Math.max(MARGIN, h - timerH - MARGIN) - timerY
    });
  }, [timerX, timerY, panelSize]);

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
      setTimerX(safePosition(dockCoords.x, dockCoords.y).x);
      setTimerY(safePosition(dockCoords.x, dockCoords.y).y);
    } else {
      setTimerDocked(false);
      setIsNearDock(false);
      const position = safePosition(finalX, finalY);
      setTimerX(position.x);
      setTimerY(position.y);
    }

    dragX.set(0);
    dragY.set(0);
  }, [dockCoords, dragX, dragY, safePosition]);

  const resetTimerPosition = useCallback(() => {
    setTimerDocked(false);
    setIsNearDock(false);
    setHasDraggedTimer(false);
    localStorage.removeItem('cuebook_timer_has_dragged');

    if (dockCoords && isFinite(dockCoords.x) && isFinite(dockCoords.y)) {
      setTimerX(safePosition(dockCoords.x, dockCoords.y).x);
      setTimerY(safePosition(dockCoords.x, dockCoords.y).y);
    } else {
      const defaultX = typeof window !== 'undefined' && window.innerWidth > 0 ? (window.innerWidth - 230) : 960;
      setTimerX(safePosition(defaultX, 80).x);
      setTimerY(safePosition(0, 80).y);
    }

    dragX.set(0);
    dragY.set(0);
  }, [dockCoords, dragX, dragY, safePosition]);

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
