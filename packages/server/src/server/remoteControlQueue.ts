import type {
  RemoteControlCommand,
  RemoteControlQueuedCommand,
} from "@herbert/shared";

export interface RemoteControlQueueStatus {
  readonly queueDepth: number;
  readonly nextCommandId: string | null;
  readonly issuedCount: number;
}

export interface RemoteControlQueue {
  enqueue(command: RemoteControlCommand): RemoteControlQueuedCommand;
  next(): RemoteControlQueuedCommand | null;
  status(): RemoteControlQueueStatus;
}

export function createRemoteControlQueue(): RemoteControlQueue {
  const queue: RemoteControlQueuedCommand[] = [];
  let sequence = 0;
  let issuedCount = 0;

  return {
    enqueue(command) {
      if (command.type === "stop" || command.type === "center") {
        queue.splice(0, queue.length);
      }

      while (queue.length >= maxQueueDepth) {
        queue.shift();
      }

      sequence += 1;
      issuedCount += 1;

      const commandWithMetadata = {
        id: `control-${sequence}`,
        createdAtMs: Date.now(),
        ...command,
      };

      queue.push(commandWithMetadata);
      return commandWithMetadata;
    },

    next() {
      return queue.shift() ?? null;
    },

    status() {
      return {
        queueDepth: queue.length,
        nextCommandId: queue[0]?.id ?? null,
        issuedCount,
      };
    },
  };
}

const maxQueueDepth = 50;
