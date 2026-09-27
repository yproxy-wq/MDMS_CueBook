import { FadeCurve } from '../types';

export const FADE_CURVES: Array<{ value: FadeCurve; label: string; description: string }> = [
  { value: 'linear', label: '直線', description: '一定の速さで変化' },
  { value: 'ease-in', label: 'ゆっくり開始', description: '後半に向けて速く変化' },
  { value: 'ease-out', label: 'ゆっくり終了', description: '開始直後に大きく変化' },
  { value: 'ease-in-out', label: 'なめらか', description: '始めと終わりを穏やかに変化' },
];

export const normalizeFadeCurve = (curve: FadeCurve | undefined): FadeCurve => curve || 'linear';

export const getFadeCurveProgress = (curve: FadeCurve | undefined, progress: number): number => {
  const value = Math.min(1, Math.max(0, progress));
  switch (normalizeFadeCurve(curve)) {
    case 'ease-in':
      return value * value;
    case 'ease-out':
      return 1 - ((1 - value) * (1 - value));
    case 'ease-in-out':
      return value < 0.5 ? 2 * value * value : 1 - (Math.pow(-2 * value + 2, 2) / 2);
    default:
      return value;
  }
};

export const createFadeCurve = (
  curve: FadeCurve | undefined,
  from: number,
  to: number,
  points = 32,
): Float32Array => {
  const safePoints = Math.max(2, points);
  return Float32Array.from({ length: safePoints }, (_, index) => {
    const progress = index / (safePoints - 1);
    return from + ((to - from) * getFadeCurveProgress(curve, progress));
  });
};

export const buildFadeCurvePath = (
  curve: FadeCurve | undefined,
  direction: 'in' | 'out',
  width = 96,
  height = 32,
  points = 24,
): string => Array.from({ length: points }, (_, index) => {
  const progress = index / (points - 1);
  const value = getFadeCurveProgress(curve, progress);
  const x = Math.round(progress * width * 100) / 100;
  const yValue = direction === 'in' ? 1 - value : value;
  const y = Math.round(yValue * height * 100) / 100;
  return (index === 0 ? 'M ' : ' L ') + x + ' ' + y;
}).join('');
