import test from "node:test";
import assert from "node:assert/strict";

import {
  acquireSlot,
  getSemaphoreState,
  resetSemaphoreStateForTests,
} from "./generation-semaphore";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test.beforeEach(() => {
  resetSemaphoreStateForTests();
});

test("cap is enforced and queued requests wait for release", async () => {
  const first = await acquireSlot();
  const second = await acquireSlot();

  let thirdResolved = false;
  const thirdPromise = acquireSlot().then((slot) => {
    thirdResolved = true;
    return slot;
  });

  await sleep(25);
  assert.equal(thirdResolved, false);
  assert.deepEqual(getSemaphoreState(), { active: 2, waiting: 1, max: 2 });

  first.release();
  const third = await thirdPromise;

  assert.equal(thirdResolved, true);
  assert.deepEqual(getSemaphoreState(), { active: 2, waiting: 0, max: 2 });

  second.release();
  third.release();
});

test("waiters acquire slots in FIFO order", async () => {
  const first = await acquireSlot();
  const second = await acquireSlot();

  const order: string[] = [];
  const thirdPromise = acquireSlot(() => {
    order.push("third-waiting");
  }).then((slot) => {
    order.push("third-acquired");
    return slot;
  });

  const fourthPromise = acquireSlot(() => {
    order.push("fourth-waiting");
  }).then((slot) => {
    order.push("fourth-acquired");
    return slot;
  });

  await sleep(25);
  first.release();
  const third = await thirdPromise;

  assert.deepEqual(order, ["third-waiting", "fourth-waiting", "third-acquired"]);

  second.release();
  const fourth = await fourthPromise;

  assert.deepEqual(order, [
    "third-waiting",
    "fourth-waiting",
    "third-acquired",
    "fourth-acquired",
  ]);

  third.release();
  fourth.release();
});

test("wait metrics reflect time spent queued", async () => {
  const first = await acquireSlot();
  const second = await acquireSlot();

  const waitingPromise = acquireSlot();
  await sleep(70);
  first.release();

  const third = await waitingPromise;
  assert.ok(third.waitMs >= 60, `expected waitMs >= 60, got ${third.waitMs}`);

  second.release();
  third.release();
});

test("double release is safe", async () => {
  const slot = await acquireSlot();
  slot.release();
  slot.release();

  assert.deepEqual(getSemaphoreState(), { active: 0, waiting: 0, max: 2 });
});

test("finally release leaves state clean after an error", async () => {
  await assert.rejects(
    (async () => {
      const slot = await acquireSlot();
      try {
        throw new Error("boom");
      } finally {
        slot.release();
      }
    })(),
    /boom/
  );

  assert.deepEqual(getSemaphoreState(), { active: 0, waiting: 0, max: 2 });
});

test("onWaiting only fires for callers that actually queue", async () => {
  let firstWaitingCalled = false;
  let secondWaitingCalled = false;
  let queuedPosition: number | null = null;

  const first = await acquireSlot(() => {
    firstWaitingCalled = true;
  });
  const second = await acquireSlot(() => {
    secondWaitingCalled = true;
  });

  const thirdPromise = acquireSlot((position) => {
    queuedPosition = position;
  });

  await sleep(25);

  assert.equal(firstWaitingCalled, false);
  assert.equal(secondWaitingCalled, false);
  assert.equal(queuedPosition, 1);

  first.release();
  const third = await thirdPromise;

  second.release();
  third.release();
});
