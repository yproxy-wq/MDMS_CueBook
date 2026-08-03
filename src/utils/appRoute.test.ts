import { describe, expect, it } from 'vitest';
import { buildAppWindowUrl, getAppWindowMode, getAppWindowPath } from './appRoute';

describe('app window routes', () => {
  it.each([
    ['/', 'session'],
    ['/session', 'session'],
    ['/session/', 'session'],
    ['/edit', 'edit'],
    ['/edit/', 'edit'],
    ['/unknown', 'session'],
  ] as const)('maps %s to %s mode', (pathname, expected) => {
    expect(getAppWindowMode(pathname)).toBe(expected);
  });

  it('returns canonical paths for window changes', () => {
    expect(getAppWindowPath('session')).toBe('/session');
    expect(getAppWindowPath('edit')).toBe('/edit');
  });

  it('preserves search parameters and hashes while changing windows', () => {
    expect(buildAppWindowUrl('edit', '?debug=1', '#media')).toBe('/edit?debug=1#media');
    expect(buildAppWindowUrl('session')).toBe('/session');
  });
});
