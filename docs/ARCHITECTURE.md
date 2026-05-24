# Architecture

Herbert is a TypeScript repo that keeps Python isolated to the hardware edge.

| Package                 | Role                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `packages/cli`          | single operator entrypoint for `bun herbert`                                         |
| `packages/robot`        | robot-side TypeScript for keyboard control, video streaming, and Python bridge calls |
| `packages/robot/python` | persistent Python subprocess that owns PiCar-X, Picamera2, and Robot HAT calls       |
| `packages/server`       | Bun HTTP server, Telegram photo relay, generic Telegram helpers, generic OpenAI lib  |
| `packages/shared`       | Zod schemas and TypeScript types for cross-process contracts                         |

The important boundary is the JSONL command protocol. TypeScript sends atomic
commands such as `set_motor`, `set_steering`, `set_camera_pan`,
`set_camera_tilt`, `take_photo`, `say`, and `stop`. Python validates and
executes those commands against the PiCar-X SDK and Robot HAT APIs.

Higher-level behavior belongs in TypeScript. Driving pulses, steering holds,
keyboard mapping, and network upload code compose atomic bridge commands instead
of expanding the Python layer.

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

Manual photo upload:

```text
keyboard photo command
  -> Python take_photo result path
  -> POST /robot/photos multipart upload
  -> packages/server Telegram sendPhoto
```

Live video:

```text
bun herbert robot:video-stream
  -> Python capture_frame JPEG result
  -> POST /robot/video/frames
  -> Mac mini server keeps latest frame and broadcasts /video.mjpeg
  -> browser opens Mac mini /
  -> browser posts manual controls to POST /control
  -> robot polls GET /robot/control/next
  -> Python set_motor/set_steering/set_camera_* commands
```

Generic OpenAI calls:

```text
domain caller
  -> packages/server/src/openai/promptOpenAI.ts
  -> OpenAI Responses API structured output
  -> caller-owned schema and behavior
```

The current operator path is manual driving. There is no active autonomous
Telegram/OpenAI task loop. The only server-side robot queue is the transient
manual-control handoff consumed by `robot:video-stream`.

## CLI

All operator commands go through one entrypoint:

```sh
bun herbert <command>
```

Packages expose library code. They should not define separate operator-facing
CLI binaries.

## Safety

Driving should be finite and inspectable. TypeScript uses short motor pulses,
and Python also stops the motors if no motor command arrives before the safety
timeout.
