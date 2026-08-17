import { describe, expect, it } from 'vitest';
import { createAsyncRequestGuard } from './asyncRequestGuard';

describe('createAsyncRequestGuard', () => {
  it('prevents an obsolete asynchronous request from committing its result', async () => {
    const guard = createAsyncRequestGuard();
    let committed = false;
    const completion = Promise.resolve().then(() => {
      if (guard.isActive()) committed = true;
    });

    guard.dispose();
    await completion;

    expect(committed).toBe(false);
    expect(guard.isActive()).toBe(false);
  });
});
