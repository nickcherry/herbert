#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import json
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
        self._camera_started = False
        self._px: Any | None = None
        self._tts: Any | None = None
        self._vilib: Any | None = None

        if not self.mock:
            with contextlib.redirect_stdout(sys.stderr):
                from picarx import Picarx

                self._px = Picarx()

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
            with contextlib.redirect_stdout(sys.stderr):
                from vilib import Vilib

                self._vilib = Vilib
                photo_dir.mkdir(parents=True, exist_ok=True)

                if not self._camera_started:
                    Vilib.camera_start(vflip=True, hflip=True)
                    self._camera_started = True
                    time.sleep(0.5)

                Vilib.take_photo(photo_name=photo_stem, path=str(photo_dir) + "/")

        return {"path": str(photo_path)}

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

                if self._camera_started and self._vilib is not None:
                    self._vilib.camera_close()

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
        return time.strftime("herbert_%Y-%m-%d_%H-%M-%S", time.localtime())

    return name[:-4] if name.lower().endswith(".jpg") else name


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
