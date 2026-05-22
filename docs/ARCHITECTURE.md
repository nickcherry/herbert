# Architecture

Herbert is a TypeScript repo that keeps Python isolated to the hardware edge.

| Package                 | Role                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `packages/cli`          | single operator entrypoint for `bun herbert`                                           |
| `packages/robot`        | robot-side TypeScript for keyboard control, server polling, and Python bridge calls    |
| `packages/robot/python` | persistent Python subprocess that owns PiCar-X, Picamera2, and Robot HAT calls         |
| `packages/server`       | Bun HTTP server, Telegram admin channel, OpenAI interpretation, and robot action queue |
| `packages/shared`       | Zod schemas and TypeScript types for cross-process contracts                           |

The important boundary is the JSONL command protocol. TypeScript sends atomic
commands such as `set_motor`, `set_steering`, `set_camera_pan`,
`set_camera_tilt`, `take_photo`, `say`, and `stop`. Python validates and
executes those commands against the PiCar-X SDK and Robot HAT APIs.

Higher-level behavior belongs in TypeScript. Driving pulses, steering holds,
keyboard mapping, network polling, and policy decisions compose atomic bridge
commands instead of expanding the Python layer.

## Runtime Shape

Keyboard control:

```text
bun herbert robot:keyboard
  -> packages/cli/src/bin/index.ts
  -> packages/robot/src/keyboard/runKeyboardDrive.ts
  -> packages/robot/src/robot/HerbertController.ts
  -> packages/robot/src/python/PythonBridgeClient.ts
  -> packages/robot/python/herbert_bridge.py
```

Server-directed robot work:

```text
server action batch
  -> packages/robot/src/tasks/runRobotTaskWorker.ts
  -> HerbertController
  -> PythonBridgeClient
  -> herbert_bridge.py
```

Manual photo upload:

```text
keyboard photo command
  -> Python take_photo result path
  -> POST /robot/photos multipart upload
  -> packages/server Telegram sendPhoto
```

Telegram-administered task loop:

```text
Telegram admin message
  -> packages/server Telegram polling
  -> OpenAI structured response
  -> SQLite robot task queue
  -> packages/robot worker polls GET /robot/action-batches/next
  -> PythonBridgeClient
  -> herbert_bridge.py
  -> end-of-turn photo
  -> POST /robot/action-batches/complete
  -> OpenAI follow-up turn
```

Each queued action batch is deliberately small. After a batch runs, the robot
captures a photo and the server uses that observation to decide the next turn.

## CLI

All operator commands go through one entrypoint:

```sh
bun herbert <command>
```

Packages expose library code. They should not define separate operator-facing
CLI binaries.

## Safety

Driving should be finite and inspectable. TypeScript uses short motor pulses and
small server action batches; Python also stops the motors if no motor command
arrives before the safety timeout.
