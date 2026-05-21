/**
 * In-memory FIFO semaphore for course generation.
 *
 * Caps concurrent course generations per function instance to avoid bursting
 * past Together AI's dynamic per-key rate limit. Module-level state persists
 * across requests on the same instance.
 */

const parsedMaxConcurrent = Number(process.env.GENERATION_MAX_CONCURRENT ?? 2);
const MAX_CONCURRENT =
  Number.isFinite(parsedMaxConcurrent) && parsedMaxConcurrent > 0
    ? Math.floor(parsedMaxConcurrent)
    : 2;

let active = 0;
const waiters: Array<() => void> = [];

export interface SlotInfo {
  queuePositionOnAcquire: number;
  waitMs: number;
  release: () => void;
}

export async function acquireSlot(
  onWaiting?: (positionInQueue: number) => void
): Promise<SlotInfo> {
  const startedWaitingAt = Date.now();

  if (active >= MAX_CONCURRENT) {
    const positionInQueue = waiters.length + 1;
    onWaiting?.(positionInQueue);
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }

  active++;

  let released = false;
  return {
    queuePositionOnAcquire: active - 1,
    waitMs: Date.now() - startedWaitingAt,
    release: () => {
      if (released) return;
      released = true;

      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) next();
    },
  };
}

export function getSemaphoreState() {
  return { active, waiting: waiters.length, max: MAX_CONCURRENT };
}

export function resetSemaphoreStateForTests() {
  active = 0;
  waiters.length = 0;
}
