# Robot Package

`packages/robot` contains the process that runs on Herbert.

## CLI

```sh
bun herbert --help
bun herbert robot:bridge-check --mock
bun herbert robot:say --mock "hello from Herbert"
bun herbert robot:keyboard --mock
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
drive the motors. They set the front wheel angle and leave it there until
another steering command, space, or quit centers it. Press left or right, then
press up or down to drive in an arc. Motor pulses stop when the pulse ends;
space stops motors and centers steering.

Keyboard mode runs the terminal in raw mode, so typed keys do not echo as
characters. Each recognized keypress prints a status line instead.

## Options

```sh
bun herbert robot:keyboard --speed 30 --turn-angle 20 --pulse-ms 200
```

- `--speed` controls motor power for drive pulses.
- `--turn-angle` controls front steering angle for left/right arrows.
- `--pulse-ms` controls how long the car keeps moving after a drive keypress.
- `--safety-ms` controls the Python watchdog timeout.
- `--python` overrides the Python executable. `HERBERT_PYTHON` can also set it.
- `--server-url` sets the Herbert server used for photo upload.
- `--no-photo-upload` keeps photos local and does not send them to the server.

## Photos

`p` takes a photo through the Python bridge. In hardware mode, keyboard control
uploads the saved image to `POST /robot/photos` on the Herbert server, and the
server relays it to the configured Telegram admin chats.

The bridge captures photos with Picamera2 directly instead of Vilib. This avoids
Vilib's `camera_start()` path, which can block indefinitely when the camera is
not detected. If capture fails with a camera-detection error, check the camera
cable and run `rpicam-hello` on Herbert.

## Speaker

```sh
bun herbert robot:say "hello from Herbert"
bun herbert robot:say --lang en-GB "hello from Herbert"
```

`robot:say` uses the Robot HAT TTS speaker. Keyboard mode also maps `v` to a
small speaker test phrase. On Herbert, SunFounder requires the Robot HAT I2S
amplifier setup before audio works:

```sh
cd ~/picar-x
sudo bash i2samp.sh
```

The speaker command may also need the robot process to run with permissions
compatible with Robot HAT audio.

## PiCar-X Startup

The SunFounder PiCar-X SDK initializes a config file through Robot HAT's
`fileDB` helper. Upstream SDK code uses `sudo chmod` and `sudo chown` while
initializing that file, which can trigger a root password prompt before Herbert
starts.

Herbert patches that startup path inside the Python bridge. On first hardware
startup it copies `/opt/picar-x/picar-x.conf` into
`~/.config/herbert/picar-x.conf` if the upstream config exists; otherwise it
creates a local Herbert config file. The bridge then passes that local config to
`Picarx()` and skips the SDK's sudo-based config ownership commands.

## SDK Assumptions

The bridge is based on SunFounder PiCar-X Python examples that use
`Picarx().forward(speed)`, `backward(speed)`, `set_dir_servo_angle(angle)`, and
camera servo setters. Photos use Picamera2 directly. Speech uses Robot HAT
`TTS.say`.

Sources:

- [PiCar-X movement docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_move.html)
- [PiCar-X keyboard control docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_keyboard.html)
- [PiCar-X SDK source](https://github.com/sunfounder/picar-x/blob/v2.0/picarx/picarx.py)
- [Robot HAT fileDB source](https://github.com/sunfounder/robot-hat/blob/v2.0/robot_hat/filedb.py)
- [Picamera2 manual](https://datasheets.raspberrypi.com/camera/picamera2-manual.pdf)
- [PiCar-X text-to-speech docs](https://docs.sunfounder.com/projects/picar-x-v20/en/latest/python/python_tts.html)
- [Robot HAT TTS API](https://docs.sunfounder.com/projects/robot-hat/en/latest/pythonApi/TTS.html)
