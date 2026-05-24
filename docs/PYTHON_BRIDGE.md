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
- `capture_frame`
- `camera_check`
- `say` with `text` and optional `lang`
- `stop`
- `shutdown`

Positive motor speed means forward. Negative motor speed means backward. Zero
or `stop` stops the drive motors.

`say` uses the first available local TTS backend in this order: older Robot HAT
`TTS`, newer Robot HAT `Pico2Wave`, SunFounder voice-assistant `Pico2Wave`, then
direct `pico2wave` plus `aplay`. The TypeScript side validates supported
languages and caps speech text at 800 characters before sending it over the
bridge.

`take_photo` uses Picamera2 still capture directly at `1296x972` and returns
the exact file path that was written. The TypeScript side gives this command a
longer timeout than normal motor and servo commands because the camera has to
initialize and warm up. The bridge does not apply an image orientation
transform; Herbert's current camera mount produces upright stills from
Picamera2's default still configuration. Camera detection failures are returned
as bridge errors rather than letting the command hang.

`capture_frame` returns a base64 JPEG for the live video path. The bridge keeps
a Picamera2 instance warm for repeated frame captures at the requested size
(default 640x480). `take_photo` closes that warm video camera before capturing a
full still so only one Picamera2 owner is active at a time.

`camera_check` returns Picamera2 camera enumeration and
`rpicam-hello --list-cameras` output for no-sudo diagnostics. It does not
capture a frame; use `bun herbert robot:photo-check` to test the same capture
path as `take_photo`.

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
