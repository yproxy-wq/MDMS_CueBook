export type AppWindowMode = 'session' | 'edit';

const normalizePathname = (pathname: string): string => {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
};

/** Resolve the main application window from the browser path. */
export const getAppWindowMode = (pathname: string): AppWindowMode =>
  normalizePathname(pathname) === '/edit' ? 'edit' : 'session';

/** Return the canonical path used when the user changes the main window. */
export const getAppWindowPath = (mode: AppWindowMode): '/session' | '/edit' =>
  mode === 'edit' ? '/edit' : '/session';

export const buildAppWindowUrl = (
  mode: AppWindowMode,
  search = '',
  hash = '',
): string => `${getAppWindowPath(mode)}${search}${hash}`;
