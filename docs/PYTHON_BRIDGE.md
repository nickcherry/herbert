# Python Bridge

The Python bridge lives at `packages/robot/python/herbert_bridge.py`.

It is intentionally small:

- read one JSON command per stdin line
- execute one atomic PiCar-X or camera action
- write one JSON response per stdout line
- keep all SDK stdout redirected to stderr so stdout remains protocol-only
- stop motors on shutdown and watchdog expiry

## Protocol

Ready message:

```json
{
  "type": "ready",
  "protocolVersion": 1,
  "implementation": "picar-x",
  "mock": false
}
```

Command:

```json
{ "id": "cmd-1", "type": "set_motor", "speed": 35 }
```

Success:

```json
{ "type": "ok", "id": "cmd-1" }
```

Error:

```json
{
  "type": "error",
  "id": "cmd-1",
  "code": "BridgeError",
  "message": "speed must be between -100 and 100."
}
```

Photo response:

```json
{
  "type": "ok",
  "id": "cmd-2",
  "result": {
    "path": "/home/pi/Pictures/herbert/herbert_2026-05-21_08-00-00.jpg"
  }
}
```

## Command Set

- `ping`
- `set_motor` with `speed` from `-100` to `100`
- `set_steering` with `angle` from `-35` to `35`
- `set_camera_pan` with `angle` from `-35` to `35`
- `set_camera_tilt` with `angle` from `-35` to `35`
- `take_photo`
- `say` with `text` and optional `lang`
- `stop`
- `shutdown`

Positive motor speed means forward. Negative motor speed means backward. Zero
or `stop` stops the drive motors.

`say` uses Robot HAT TTS. The TypeScript side validates supported languages and
keeps speech text short before sending it over the bridge.

`take_photo` uses Picamera2 still capture directly and returns the exact file
path that was written. The TypeScript side gives this command a longer timeout
than normal motor and servo commands because the camera has to initialize and
warm up. Camera detection failures are returned as bridge errors rather than
letting the command hang.

`shutdown` stops the drive motors. Keyboard mode also centers steering before
closing, but it does not send camera pan or tilt commands during shutdown.

On hardware startup, the bridge passes `Picarx()` a local config path at
`~/.config/herbert/picar-x.conf` and patches Robot HAT's config-file helper to
skip upstream privileged ownership calls. It also installs a no-sudo guard
around common shell-out APIs before importing the hardware SDK. If the SDK tries
to launch a privileged command, the bridge returns an error instead of prompting
for a password.

## Isolation Rule

Do not import Python from TypeScript except through `PythonBridgeClient`.
Do not add robot behavior policy to Python unless it is a hardware safety
requirement. The bridge should stay close to the SDK.
