import { describe, it, expect } from 'vitest';
import {
  parseCoordinate,
  constrainCoordinate,
  getInBoundsCoordinates,
  isNearDockPosition
} from './coordinateHelper';

describe('coordinateHelper', () => {
  describe('parseCoordinate', () => {
    it('should parse valid floats', () => {
      expect(parseCoordinate('123.45', 80)).toBe(123.45);
      expect(parseCoordinate('-10', 80)).toBe(-10);
    });

    it('should return default value on null', () => {
      expect(parseCoordinate(null, 80)).toBe(80);
    });

    it('should return default value on empty or invalid input', () => {
      expect(parseCoordinate('', 80)).toBe(80);
      expect(parseCoordinate('abc', 80)).toBe(80);
    });

    it('should return default value on NaN or Infinity', () => {
      expect(parseCoordinate('NaN', 80)).toBe(80);
      expect(parseCoordinate('Infinity', 80)).toBe(80);
    });
  });

  describe('constrainCoordinate', () => {
    it('should keep a value within boundaries', () => {
      expect(constrainCoordinate(50, 10, 100)).toBe(50);
      expect(constrainCoordinate(5, 10, 100)).toBe(10);
      expect(constrainCoordinate(150, 10, 100)).toBe(100);
    });
  });

  describe('getInBoundsCoordinates', () => {
    it('should bounds off-screen points correctly', () => {
      const result = getInBoundsCoordinates(2000, 2000, 1024, 768);
      expect(result.x).toBeLessThanOrEqual(1024 - 100);
      expect(result.y).toBeLessThanOrEqual(768 - 100);
    });

    it('should handle zero or negative bounds safely', () => {
      const result = getInBoundsCoordinates(-50, -50, 1024, 768);
      expect(result.x).toBe(10);
      expect(result.y).toBe(10);
    });

    it('should handle NaN or infinite input reliably using defaults', () => {
      const result = getInBoundsCoordinates(NaN, Infinity, 1024, 768);
      expect(result.x).toBe(1024 - 250);
      expect(result.y).toBe(80);
    });
  });

  describe('isNearDockPosition', () => {
    it('should trigger snap if close rectangularly', () => {
      // Dock at (100, 100), width 240, height 110. Center is (220, 155)
      // drag at (250, 180). dx=30, dy=25 < threshold
      expect(isNearDockPosition(250, 180, 100, 100)).toBe(true);
    });

    it('should trigger snap if within Euclidean radius', () => {
      // drag at (380, 155). dx=160, dy=0. Since 160 < 200 and 0 < 160, it should be true.
      expect(isNearDockPosition(380, 155, 100, 100)).toBe(true);
    });

    it('should NOT trigger snap if too far away', () => {
      // drag at (1000, 1000)
      expect(isNearDockPosition(1000, 1000, 100, 100)).toBe(false);
    });
  });
});
