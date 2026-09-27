import { describe, expect, it } from 'vitest';
import { buildFadeCurvePath, createFadeCurve, getFadeCurveProgress, normalizeFadeCurve } from './fadeCurve';

describe('fade curves', () => {
  it('keeps linear as the storage-compatible default', () => {
    expect(normalizeFadeCurve(undefined)).toBe('linear');
    expect(getFadeCurveProgress(undefined, 0.25)).toBe(0.25);
  });

  it('uses the expected easing direction', () => {
    expect(getFadeCurveProgress('ease-in', 0.5)).toBeLessThan(0.5);
    expect(getFadeCurveProgress('ease-out', 0.5)).toBeGreaterThan(0.5);
    expect(getFadeCurveProgress('ease-in-out', 0.5)).toBe(0.5);
  });

  it('creates a gain curve with exact endpoints', () => {
    const curve = createFadeCurve('ease-in', 0, 0.8, 16);
    expect(curve[0]).toBe(0);
    expect(curve[curve.length - 1]).toBeCloseTo(0.8);
  });

  it('builds a distinct visual path for each direction', () => {
    expect(buildFadeCurvePath('linear', 'in')).not.toBe(buildFadeCurvePath('linear', 'out'));
  });
});
