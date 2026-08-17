/**
 * Marks an asynchronous request as obsolete when its owning effect is replaced
 * or unmounted. Callers must check isActive() before committing any result.
 */
export function createAsyncRequestGuard() {
  let active = true;

  return {
    isActive: () => active,
    dispose: () => {
      active = false;
    },
  };
}
