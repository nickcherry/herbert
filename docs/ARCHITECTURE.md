# Architecture

Herbert is a TypeScript repo that keeps Python isolated to the hardware edge.

```text
packages/robot
  Bun/TypeScript process on Herbert
  keyboard CLI now
  polling or WebSocket listener later
  low-level typed API over the Python bridge

packages/server
  Bun/TypeScript process on the Mac mini
  Telegram administration channel
  future command broker for Herbert

packages/shared
  Zod schemas and TypeScript types for cross-boundary commands and API payloads

packages/cli
  single operator entrypoint for `bun herbert`

packages/robot/python
  persistent Python subprocess
  owns Picarx() and Vilib calls
  JSONL stdin/stdout protocol
  motor safety watchdog
```

The important boundary is the JSONL command protocol. TypeScript sends atomic
commands such as `set_motor`, `set_steering`, `set_camera_pan`,
`set_camera_tilt`, `take_photo`, `say`, and `stop`. Python validates and
executes those commands against the PiCar-X SDK and Robot HAT APIs.

Higher-level behavior belongs in TypeScript. Driving pulses, steering holds,
keyboard mapping, future phone commands, network reconnects, and policy
decisions should compose the atomic commands rather than expanding the Python
bridge.

## Runtime Shape

The first operator path is:

```text
bun herbert robot:keyboard
  -> packages/cli/src/bin/index.ts
  -> packages/robot/src/keyboard/runKeyboardDrive.ts
  -> packages/robot/src/robot/HerbertController.ts
  -> packages/robot/src/python/PythonBridgeClient.ts
  -> packages/robot/python/herbert_bridge.py
```

The future phone path should replace only the command source:

```text
poll/WebSocket command source
  -> HerbertController
  -> PythonBridgeClient
  -> herbert_bridge.py
```

Photo upload is already server-mediated:

```text
keyboard photo command
  -> Python take_photo result path
  -> POST /robot/photos multipart upload
  -> packages/server Telegram sendPhoto
```

The future administered path should add the server as the coordinator:

```text
Telegram admin message
  -> packages/server Telegram polling
  -> authenticated command queue or socket
  -> packages/robot process on Herbert
  -> PythonBridgeClient
  -> herbert_bridge.py
```

## CLI

All operator commands go through one entrypoint:

```sh
bun herbert <command>
```

Packages expose library code. They should not define separate operator-facing
CLI binaries.

## Safety

Driving should be pulse-based at the TypeScript layer and watchdog-protected at
the Python layer.

The Python bridge stops the motors if no motor command arrives before its safety
timeout. This protects against a crashed Bun process, broken SSH session, or
future network disconnect.
