#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import getpass
import json
import shutil
import sys
import threading
import time
from pathlib import Path
from typing import Any

PROTOCOL_VERSION = 1
MOTOR_MIN = -100
MOTOR_MAX = 100
STEERING_MIN = -35
STEERING_MAX = 35
CAMERA_MIN = -35
CAMERA_MAX = 35
SPEECH_TEXT_MAX = 300
SPEECH_LANGUAGES = {"en-US", "en-GB", "zh-CN", "de-DE", "es-ES"}
PHOTO_WARMUP_S = 1.5
DEFAULT_PICARX_CONFIG_PATH = Path("/opt/picar-x/picar-x.conf")
HERBERT_PICARX_CONFIG_PATH = Path.home() / ".config" / "herbert" / "picar-x.conf"


class BridgeError(Exception):
    pass


class Hardware:
    def __init__(self, *, mock: bool, safety_timeout_ms: int) -> None:
        self.mock = mock
        self.safety_timeout_s = safety_timeout_ms / 1000
        self._lock = threading.RLock()
        self._closed = False
        self._motor_active = False
        self._last_motor_command_at = time.monotonic()
        self._px: Any | None = None
        self._tts: Any | None = None

        if not self.mock:
            with contextlib.redirect_stdout(sys.stderr):
                from picarx import Picarx

                patch_picarx_startup(Picarx)
                self._px = Picarx(config=str(prepare_picarx_config()))

        self._watchdog = threading.Thread(target=self._watchdog_loop, daemon=True)
        self._watchdog.start()

    def ping(self) -> dict[str, str]:
        return {"status": "ok"}

    def set_motor(self, speed: int) -> None:
        speed = require_int(
            value=speed,
            name="speed",
            minimum=MOTOR_MIN,
            maximum=MOTOR_MAX,
        )

        with self._lock:
            self._last_motor_command_at = time.monotonic()
            self._motor_active = speed != 0

            if self.mock:
                return

            px = self._require_px()
            with contextlib.redirect_stdout(sys.stderr):
                if speed > 0:
                    px.forward(speed)
                elif speed < 0:
                    px.backward(abs(speed))
                else:
                    self._stop_locked()

    def set_steering(self, angle: int) -> None:
        angle = require_int(
            value=angle,
            name="angle",
            minimum=STEERING_MIN,
            maximum=STEERING_MAX,
        )

        with self._lock:
            if self.mock:
                return

            px = self._require_px()
            with contextlib.redirect_stdout(sys.stderr):
                px.set_dir_servo_angle(angle)

    def set_camera_pan(self, angle: int) -> None:
        angle = require_int(
            value=angle,
            name="angle",
            minimum=CAMERA_MIN,
            maximum=CAMERA_MAX,
        )

        with self._lock:
            if self.mock:
                return

            px = self._require_px()
            self._call_first(px, ["set_cam_pan_angle", "set_camera_servo1_angle"], angle)

    def set_camera_tilt(self, angle: int) -> None:
        angle = require_int(
            value=angle,
            name="angle",
            minimum=CAMERA_MIN,
            maximum=CAMERA_MAX,
        )

        with self._lock:
            if self.mock:
                return

            px = self._require_px()
            self._call_first(px, ["set_cam_tilt_angle", "set_camera_servo2_angle"], angle)

    def stop(self) -> None:
        with self._lock:
            self._motor_active = False

            if self.mock:
                return

            self._stop_locked()

    def take_photo(self, *, directory: str | None, name: str | None) -> dict[str, str]:
        photo_dir = Path(directory).expanduser() if directory else Path.home() / "Pictures" / "herbert"
        photo_stem = normalize_photo_stem(name)
        photo_path = photo_dir / f"{photo_stem}.jpg"

        if self.mock:
            return {"path": str(photo_path)}

        with self._lock:
            self._capture_photo(photo_path)

        return {"path": str(photo_path)}

    def _capture_photo(self, photo_path: Path) -> None:
        picam2: Any | None = None

        try:
            with contextlib.redirect_stdout(sys.stderr):
                from picamera2 import Picamera2

                picam2 = Picamera2()
                capture_config = create_still_configuration(picam2)
                photo_path.parent.mkdir(parents=True, exist_ok=True)

                picam2.configure(capture_config)
                picam2.start()
                time.sleep(PHOTO_WARMUP_S)
                picam2.capture_file(str(photo_path))
        except IndexError as error:
            raise BridgeError(
                "No Raspberry Pi camera was detected. Check the camera cable and run rpicam-hello."
            ) from error
        except BridgeError:
            raise
        except Exception as error:  # noqa: BLE001
            raise BridgeError(f"Camera capture failed: {error}") from error
        finally:
            if picam2 is not None:
                with contextlib.suppress(Exception), contextlib.redirect_stdout(sys.stderr):
                    picam2.close()

        if not photo_path.is_file() or photo_path.stat().st_size == 0:
            raise BridgeError(f"Camera did not write a non-empty photo: {photo_path}")

    def say(self, *, text: str, lang: str | None) -> None:
        text = require_string(text, name="text")

        if len(text) > SPEECH_TEXT_MAX:
            raise BridgeError(f"text must be {SPEECH_TEXT_MAX} characters or fewer.")

        if lang is not None:
            lang = require_string(lang, name="lang")

            if lang not in SPEECH_LANGUAGES:
                allowed = ", ".join(sorted(SPEECH_LANGUAGES))
                raise BridgeError(f"lang must be one of: {allowed}.")

        with self._lock:
            if self.mock:
                return

            with contextlib.redirect_stdout(sys.stderr):
                if self._tts is None:
                    from robot_hat import TTS

                    self._tts = TTS()

                if lang is not None:
                    self._tts.lang(lang)

                self._tts.say(text)

    def close(self) -> None:
        with self._lock:
            self._closed = True
            self._motor_active = False

            if self.mock:
                return

            with contextlib.redirect_stdout(sys.stderr):
                self._stop_locked()

    def _require_px(self) -> Any:
        if self._px is None:
            raise BridgeError("PiCar-X hardware is not initialized.")

        return self._px

    def _stop_locked(self) -> None:
        px = self._require_px()

        if hasattr(px, "stop"):
            px.stop()
            return

        px.forward(0)

    def _call_first(self, target: Any, names: list[str], value: int) -> None:
        for name in names:
            method = getattr(target, name, None)

            if method is None:
                continue

            with contextlib.redirect_stdout(sys.stderr):
                method(value)
            return

        joined = ", ".join(names)
        raise BridgeError(f"PiCar-X SDK did not expose any of: {joined}")

    def _watchdog_loop(self) -> None:
        while True:
            time.sleep(0.05)

            with self._lock:
                if self._closed:
                    return

                expired = (
                    self._motor_active
                    and time.monotonic() - self._last_motor_command_at
                    > self.safety_timeout_s
                )

            if expired:
                try:
                    self.stop()
                except Exception as error:  # noqa: BLE001
                    print(f"watchdog stop failed: {error}", file=sys.stderr)


def main() -> int:
    args = parse_args()

    try:
        hardware = Hardware(
            mock=args.mock,
            safety_timeout_ms=args.safety_timeout_ms,
        )
    except Exception as error:  # noqa: BLE001
        write_response(
            {
                "type": "error",
                "code": error.__class__.__name__,
                "message": str(error),
            }
        )
        return 1

    write_response(
        {
            "type": "ready",
            "protocolVersion": PROTOCOL_VERSION,
            "implementation": "mock" if args.mock else "picar-x",
            "mock": args.mock,
        }
    )

    try:
        for line in sys.stdin:
            should_continue = handle_line(hardware=hardware, line=line)

            if not should_continue:
                break
    finally:
        hardware.close()

    return 0


def handle_line(*, hardware: Hardware, line: str) -> bool:
    try:
        command = json.loads(line)

        if not isinstance(command, dict):
            raise BridgeError("Command must be a JSON object.")

        command_id = require_string(command.get("id"), name="id")
        command_type = require_string(command.get("type"), name="type")

        if command_type == "ping":
            result = hardware.ping()
        elif command_type == "set_motor":
            hardware.set_motor(command.get("speed"))
            result = None
        elif command_type == "set_steering":
            hardware.set_steering(command.get("angle"))
            result = None
        elif command_type == "set_camera_pan":
            hardware.set_camera_pan(command.get("angle"))
            result = None
        elif command_type == "set_camera_tilt":
            hardware.set_camera_tilt(command.get("angle"))
            result = None
        elif command_type == "stop":
            hardware.stop()
            result = None
        elif command_type == "take_photo":
            result = hardware.take_photo(
                directory=optional_string(command.get("directory"), name="directory"),
                name=optional_string(command.get("name"), name="name"),
            )
        elif command_type == "say":
            hardware.say(
                text=require_string(command.get("text"), name="text"),
                lang=optional_string(command.get("lang"), name="lang"),
            )
            result = None
        elif command_type == "shutdown":
            hardware.stop()
            write_response({"type": "ok", "id": command_id})
            return False
        else:
            raise BridgeError(f"Unsupported command type: {command_type}")

        response: dict[str, Any] = {"type": "ok", "id": command_id}

        if result is not None:
            response["result"] = result

        write_response(response)
        return True
    except Exception as error:  # noqa: BLE001
        command_id = extract_command_id(line)
        response = {
            "type": "error",
            "code": error.__class__.__name__,
            "message": str(error),
        }

        if command_id is not None:
            response["id"] = command_id

        write_response(response)
        return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mock", action="store_true")
    parser.add_argument("--safety-timeout-ms", type=int, default=750)
    return parser.parse_args()


def write_response(response: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def require_string(value: Any, *, name: str) -> str:
    if not isinstance(value, str) or value == "":
        raise BridgeError(f"{name} must be a non-empty string.")

    return value


def optional_string(value: Any, *, name: str) -> str | None:
    if value is None:
        return None

    return require_string(value, name=name)


def require_int(*, value: Any, name: str, minimum: int, maximum: int) -> int:
    if not isinstance(value, int):
        raise BridgeError(f"{name} must be an integer.")

    if value < minimum or value > maximum:
        raise BridgeError(f"{name} must be between {minimum} and {maximum}.")

    return value


def normalize_photo_stem(name: str | None) -> str:
    if name is None:
        timestamp = time.strftime("herbert_%Y-%m-%d_%H-%M-%S", time.localtime())
        milliseconds = int((time.time() % 1) * 1000)
        return f"{timestamp}_{milliseconds:03d}"

    return name[:-4] if name.lower().endswith(".jpg") else name


def create_still_configuration(picam2: Any) -> Any:
    try:
        from libcamera import Transform

        return picam2.create_still_configuration(
            transform=Transform(hflip=True, vflip=True)
        )
    except TypeError:
        return picam2.create_still_configuration()


def prepare_picarx_config() -> Path:
    HERBERT_PICARX_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)

    if HERBERT_PICARX_CONFIG_PATH.exists():
        return HERBERT_PICARX_CONFIG_PATH

    if DEFAULT_PICARX_CONFIG_PATH.is_file():
        try:
            shutil.copyfile(DEFAULT_PICARX_CONFIG_PATH, HERBERT_PICARX_CONFIG_PATH)
            return HERBERT_PICARX_CONFIG_PATH
        except OSError:
            pass

    HERBERT_PICARX_CONFIG_PATH.write_text("# Herbert PiCar-X config\n\n")
    return HERBERT_PICARX_CONFIG_PATH


def patch_picarx_startup(Picarx: Any) -> None:
    globals_ = Picarx.__init__.__globals__
    module_os = globals_.get("os")

    if module_os is not None:
        module_os.getlogin = getpass.getuser

    file_db = globals_.get("fileDB")

    if file_db is not None:
        file_db.file_check_create = herbert_file_check_create


def herbert_file_check_create(
    self: Any,
    file_path: str,
    mode: int | None = None,
    owner: str | None = None,
) -> None:
    del mode, owner
    path = Path(file_path)

    if path.exists():
        if not path.is_file():
            print(f"{path} exists but is not a file.", file=sys.stderr)
        return

    if path.parent.exists() and not path.parent.is_dir():
        print(f"{path.parent} exists but is not a directory.", file=sys.stderr)
        return

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("# Herbert PiCar-X config\n\n")


def extract_command_id(line: str) -> str | None:
    try:
        parsed = json.loads(line)
    except Exception:  # noqa: BLE001
        return None

    if not isinstance(parsed, dict):
        return None

    command_id = parsed.get("id")

    return command_id if isinstance(command_id, str) else None


if __name__ == "__main__":
    raise SystemExit(main())
