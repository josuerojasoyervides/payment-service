// src/testing/vitest.setup.ts
import { afterEach, vi } from 'vitest';

afterEach(() => {
  // Check for fake timers leaks
  const leakedFakeTimers = vi.isFakeTimers();
  let pendingTimers: number | null = null;

  try {
    if (leakedFakeTimers) {
      pendingTimers = vi.getTimerCount();

      /**
       * Diagnostic useful for debugging
       *
       * - runOnlyPendingTimers: runs only the pending timers (to avoid infinite loops)
       * - clearAllTimers: clears all timers
       */
      vi.runOnlyPendingTimers();
      vi.clearAllTimers();
    }
  } finally {
    // Reset to real state even if there is no leak
    vi.useRealTimers();
  }

  if (leakedFakeTimers) {
    const details = pendingTimers === null ? '' : ` Pending timers: ${pendingTimers}.`;
    throw new Error(
      [
        `Fake timers leak detected.${details}`,
        ``,
        `A test enabled vi.useFakeTimers() but did NOT restore vi.useRealTimers().`,
        `Fix pattern (preferred):`,
        `  afterEach(() => {`,
        `    vi.runOnlyPendingTimers();`,
        `    vi.useRealTimers();`,
        `  });`,
        ``,
        `Even better: centralize via a helper (see fake timers helpers).`,
      ].join('\n'),
    );
  }
});
