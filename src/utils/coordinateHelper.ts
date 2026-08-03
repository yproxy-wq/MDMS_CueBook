/**
 * Utility functions for safe float coordinate parsing, boundary enforcement,
 * and snap calculations for floating UI components.
 * 
 * Follows UNIX philosophy of doing one thing perfectly and being pure/testable.
 */

/**
 * Safely parses a coordinate float value from local storage or any string input.
 * Falls back to defaultValue if invalid, NaN, or infinite.
 */
export function parseCoordinate(value: string | null, defaultValue: number): number {
  if (value === null) return defaultValue;
  const parsed = parseFloat(value);
  if (!isFinite(parsed) || isNaN(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Constrains a coordinate value to be within min and max boundaries.
 */
export function constrainCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes safe, bounded (x, y) coordinates for a floating panel of standard width
 * so that it doesn't get pushed off-screen or rendered invisibly.
 */
export function getInBoundsCoordinates(
  x: number,
  y: number,
  viewportW: number,
  viewportH: number,
  padding: number = 10,
  minVisibleW: number = 100,
  minVisibleH: number = 100
): { x: number; y: number } {
  const safeX = !isFinite(x) || isNaN(x)
    ? viewportW - 250
    : constrainCoordinate(x, padding, Math.max(padding, viewportW - minVisibleW));

  const safeY = !isFinite(y) || isNaN(y)
    ? 80
    : constrainCoordinate(y, padding, Math.max(padding, viewportH - minVisibleH));

  return { x: safeX, y: safeY };
}

/**
 * Calculates check if custom drag coordinates are near/within snap range of a dock position.
 */
export function isNearDockPosition(
  dragX: number,
  dragY: number,
  dockX: number,
  dockY: number,
  dockW: number = 240,
  dockH: number = 110,
  snapThreshold: number = 250
): boolean {
  // Center of dock area
  const dockCenterX = dockX + dockW / 2;
  const dockCenterY = dockY + dockH / 2;

  const diffX = Math.abs(dragX - dockCenterX);
  const diffY = Math.abs(dragY - dockCenterY);

  // Snaps if within rectangular bounds (DX < 200, DY < 160) or Euclidean distance < 250px
  const isRectClose = diffX < 200 && diffY < 160;
  const distance = Math.sqrt(diffX * diffX + diffY * diffY);
  const isDistanceClose = distance < snapThreshold;

  return isRectClose || isDistanceClose;
}
