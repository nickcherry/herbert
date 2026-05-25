# Robot Package

`packages/robot` contains the process that runs on Herbert.

## CLI

```sh
bun herbert --help
bun herbert robot:bridge-check --mock
bun herbert robot:camera-check --mock
bun herbert robot:photo-check --mock
bun herbert robot:say --mock "hello from Herbert"
bun herbert robot:keyboard --mock
bun herbert robot:stream --mock --once
bun herbert robot:keyboard
```

Use `--mock` anywhere without the PiCar-X SDK. Run without `--mock` on
Herbert's Raspberry Pi.

## Keyboard Controls

```text
↑       drive forward pulse
↓       drive backward pulse
←       steer wheels left
→       steer wheels right

w       camera tilt up
s       camera tilt down
a       camera pan left
d       camera pan right

p       take photo
v       say hello
space   stop and center steering
q       stop and quit
```

The PiCar-X steers like a car. Left and right do not spin in place and do not
drive the motors. Each left or right press adjusts the current wheel angle by
`--turn-angle` and leaves it there until another steering command, space, or
quit changes it. Press up or down after steering to drive in an arc.

Keyboard mode runs the terminal in raw mode, so typed keys do not echo as
characters. Each recognized keypress prints a status line instead.

## Options

```sh
bun herbert robot:keyboard --speed 30 --turn-angle 20 --pulse-ms 200
```

- `--speed` controls motor power for drive pulses.
- `--turn-angle` controls the steering step for left/right arrows.
- `--camera-step` controls the pan/tilt step for `wasd`.
- `--pulse-ms` controls how long the car keeps moving after a drive keypress.
- `--safety-ms` controls the Python watchdog timeout.
- `--python` overrides the Python executable. `HERBERT_PYTHON` can also set it.
- `--server-url` sets the Herbert server used for photo upload, video upload,
  and browser-control polling. The current default points at the Mac mini:
  `http://mac-mini.local:8787`.
- `--no-photo-upload` keeps photos local and does not send them to the server.
- `--fps`, `--frame-width`, and `--frame-height` tune `robot:stream`.
- `--once` makes `robot:stream` send one frame and exit.

## Physical Size

Herbert's approximate assembled PiCar-X envelope is 216 mm long, 143 mm wide,
and 113 mm tall (8.5 x 5.6 x 4.5 inches). Treat the wheel-level path as the
main clearance constraint: Herbert can fit under many chairs, coffee tables,
side tables, and furniture overhangs when the underside clearance is roughly
above 12 cm / 5 inches and the floor path is wider than the body plus a margin.

## Photos

`p` takes a photo through the Python bridge. In hardware mode, keyboard control
uploads the saved image to `POST /robot/photos` on the Herbert server, and the
server relays it to the configured Telegram admin chats. In mock mode, keyboard
control saves the photo path but skips upload.

To upload photos while the server is running on the Mac mini, start the server
there:

```sh
bun herbert server:start
```

Then run keyboard control on Herbert:

```sh
bun herbert robot:keyboard
```

If the Mac mini's Bonjour hostname changes, pass the LAN URL explicitly:

```sh
bun herbert robot:keyboard --server-url http://<mac-mini-hostname>.local:8787
```

The bridge captures photos with Picamera2 directly instead of Vilib. Herbert's
current camera mount uses Picamera2's default still orientation without an extra
flip or rotation. If capture fails with a camera-detection error, check the
camera cable and run `rpicam-hello` on Herbert.

For camera diagnostics from Herbert's runtime environment, run:

```sh
bun herbert robot:camera-check
```

This reports Picamera2's camera count and the output of
`rpicam-hello --list-cameras` without using sudo. It confirms camera
enumeration, but it does not capture a frame.

To test the same Picamera2 capture path used by keyboard mode, run:

```sh
bun herbert robot:photo-check
```

Herbert captures stills at `1296x972`, which matches a faster OV5647 camera
mode than the full-resolution default and is sufficient for operator feedback.

## Live Video

```sh
bun herbert server:start
bun herbert robot:stream
```

The Mac mini runs the server and hosts the browser UI at `/`. Herbert runs
`robot:stream`, captures JPEG frames through the Python bridge, and pushes
them to `POST /robot/video/frames`. The server keeps the latest frame in memory
and exposes it to browsers as `/video.mjpeg`, `/video/latest.jpg`, and
`/video/status`.

The same page also exposes manual controls for forward and backward drive
pulses, steering, camera pan/tilt, and a center command that stops the motors,
straightens the wheels, points the camera straight ahead, and tilts it fully
up. Browser controls post to `POST /control` on the Mac mini. `robot:stream`
polls `GET /robot/control/next`, executes one command at a time through the
Python bridge, and keeps capture commands serialized with movement so a frame
capture cannot delay the stop at the end of a drive pulse.

When `robot:stream` starts, Herbert runs the same center command once before it
begins streaming and polling.

If the Mac mini server is protected with Basic Auth, run Herbert with the same
credentials in its environment:

```sh
HERBERT_BASIC_AUTH_USERNAME=nick
HERBERT_BASIC_AUTH_PASSWORD='a long password'
bun herbert robot:stream
```

The robot process sends those credentials on photo uploads, video frame uploads,
and control polling requests.

If Herbert cannot resolve the default `mac-mini.local` hostname, or the server
is running on a different computer, pass the server machine's LAN URL
explicitly. For example, if the server is running on a machine with LAN IP
`192.168.86.121`:

```sh
bun herbert robot:stream --server-url http://192.168.86.121:8787
```

That URL is used for both frame uploads and polling
`GET /robot/control/next`.

Defaults are 640x480 at 2 fps. Increase them only after checking LAN latency
and CPU load:

```sh
bun herbert robot:stream --fps 4 --frame-width 960 --frame-height 720
```

The video stream uses Picamera2 directly. It keeps a camera instance warm for
frame capture; taking a full still photo closes that warm video camera first so
Picamera2 does not fight over the device.

## Speaker

```sh
bun herbert robot:say "hello from Herbert"
bun herbert robot:say --lang en-GB "hello from Herbert"
```

`robot:say` uses the Robot HAT or SunFounder voice-assistant Pico2Wave TTS
engine and accepts up to 800 characters. Keyboard mode also maps `v` to a
small speaker test phrase. Herbert does not run privileged setup commands from
the app. If audio is not configured at the OS image level, `robot:say` should
fail or be silent rather than asking for a root password.

## PiCar-X Startup

The SunFounder PiCar-X SDK initializes a config file through Robot HAT's
`fileDB` helper. Upstream SDK code can run privileged file ownership commands
while initializing that file, which can trigger a root password prompt before
Herbert starts.

Herbert patches that startup path inside the Python bridge. On first hardware
startup it copies `/opt/picar-x/picar-x.conf` into
`~/.config/herbert/picar-x.conf` if the upstream config exists; otherwise it
creates a local Herbert config file. The bridge then passes that local config to
`Picarx()` and skips the SDK's privileged config ownership commands.

The Python bridge also installs a no-sudo runtime guard before importing the
hardware SDK. If SDK code tries to launch a privileged shell command, Herbert
raises a bridge error instead of prompting for a password.

## SDK Assumptions

The bridge is based on SunFounder PiCar-X Python examples that use
`Picarx().forward(speed)`, `backward(speed)`, `set_dir_servo_angle(angle)`, and
camera servo setters. Photos use Picamera2 directly. Speech prefers older Robot
HAT `TTS`, then newer Robot HAT `Pico2Wave`, then SunFounder voice-assistant
`Pico2Wave`, then a direct local `pico2wave`/`aplay` fallback.

Sources:

- [PiCar-X movement docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_move.html)
- [PiCar-X keyboard control docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_keyboard.html)
- [PiCar-X SDK source](https://github.com/sunfounder/picar-x/blob/v2.0/picarx/picarx.py)
- [Robot HAT fileDB source](https://github.com/sunfounder/robot-hat/blob/v2.0/robot_hat/filedb.py)
- [Picamera2 manual](https://datasheets.raspberrypi.com/camera/picamera2-manual.pdf)
- [PiCar-X text-to-speech docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_tts.html)
- [Robot HAT TTS API](https://docs.sunfounder.com/projects/robot-hat/en/latest/pythonApi/TTS.html)
- [SunFounder forum dimensional drawing](https://forum.sunfounder.com/t/actual-physical-dimensions-of-picar-x-robot/2446)
