/**
 * Serializes all reads and writes of the robot task queue document inside
 * this process. The queue is one typed JSON document, so concurrent mutators
 * would otherwise stomp each other's slices. The lock is module-scoped (a
 * promise chain) and shared by every operation in this folder.
 */

let lock: Promise<void> = Promise.resolve();

export async function withRobotTaskQueueLock<Result>(
  run: () => Promise<Result>,
): Promise<Result> {
  const previous = lock;
  let release: () => void = () => {};
  lock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  try {
    return await run();
  } finally {
    release();
  }
}
