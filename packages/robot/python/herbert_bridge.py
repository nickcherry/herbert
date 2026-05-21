#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import getpass
import json
import os
import shutil
import shlex
import subprocess
import sys
import tempfile
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
NO_SUDO_MESSAGE = (
    "Herbert runtime never runs sudo. Fix device permissions or hardware setup "
    "outside the robot process."
)
_ORIGINAL_OS_POPEN = os.popen
_ORIGINAL_OS_SYSTEM = os.system
_ORIGINAL_SUBPROCESS_RUN = subprocess.run
_ORIGINAL_SUBPROCESS_CALL = subprocess.call
_ORIGINAL_SUBPROCESS_CHECK_CALL = subprocess.check_call
_ORIGINAL_SUBPROCESS_CHECK_OUTPUT = subprocess.check_output
_ORIGINAL_SUBPROCESS_POPEN = subprocess.Popen


class BridgeError(Exception):
    pass


class DirectPico2Wave:
    def __init__(self, *, lang: str | None) -> None:
        self._lang = lang or "en-US"

    def set_lang(self, lang: str) -> None:
        self._lang = lang

    def say(self, text: str) -> None:
        pico2wave = shutil.which("pico2wave")
        aplay = shutil.which("aplay")

        if pico2wave is None:
            raise BridgeError("pico2wave is not installed or not on PATH.")

        if aplay is None:
            raise BridgeError("aplay is not installed or not on PATH.")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as wav_file:
            wav_path = Path(wav_file.name)

        try:
            run_checked_command(
                [
                    pico2wave,
                    "-l",
                    self._lang,
                    "-w",
                    str(wav_path),
                    text,
                ],
                context="pico2wave",
            )
            run_checked_command([aplay, str(wav_path)], context="aplay")
        finally:
            with contextlib.suppress(OSError):
                wav_path.unlink()


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
            install_no_sudo_guard()

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

    def camera_check(self) -> dict[str, Any]:
        if self.mock:
            return {
                "picamera2": {
                    "available": True,
                    "cameraCount": 1,
                    "cameras": [{"model": "mock-camera"}],
                    "version": "mock",
                },
                "rpicamHello": {
                    "available": True,
                    "exitCode": 0,
                    "stdout": "Available cameras\n0 : mock-camera\n",
                    "stderr": "",
                },
            }

        return camera_check()

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
            raise BridgeError(camera_detection_error_message()) from error
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
                    self._tts = create_tts(lang=lang)

                if lang is not None:
                    set_tts_language(tts=self._tts, lang=lang)

                self._tts.say(text)

    def close(self) -> None:
        with self._lock:
            self._closed = True
            self._motor_active = False

            if self.mock or self._px is None:
                return

            with contextlib.redirect_stdout(sys.stderr):
                self._stop_locked()

    def _require_px(self) -> Any:
        if self._px is None:
            with contextlib.redirect_stdout(sys.stderr):
                from picarx import Picarx

                patch_picarx_startup(Picarx)
                self._px = Picarx(config=str(prepare_picarx_config()))

        return self._px

    def _stop_locked(self) -> None:
        if self._px is None:
            return

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
        elif command_type == "camera_check":
            result = hardware.camera_check()
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


def camera_detection_error_message() -> str:
    return (
        "No Raspberry Pi camera was detected. "
        f"{camera_check_summary(camera_check())} "
        "Run `bun herbert robot:camera-check` on Herbert for the full diagnostics."
    )


def camera_check() -> dict[str, Any]:
    return {
        "picamera2": picamera2_check(),
        "rpicamHello": rpicam_hello_check(),
    }


def picamera2_check() -> dict[str, Any]:
    try:
        with contextlib.redirect_stdout(sys.stderr):
            import picamera2
            from picamera2 import Picamera2

            cameras = Picamera2.global_camera_info()

        return {
            "available": True,
            "cameraCount": len(cameras),
            "cameras": json_safe(cameras),
            "version": str(getattr(picamera2, "__version__", "unknown")),
        }
    except Exception as error:  # noqa: BLE001
        return {
            "available": False,
            "error": str(error),
        }


def rpicam_hello_check() -> dict[str, Any]:
    try:
        completed = subprocess.run(
            ["rpicam-hello", "--list-cameras"],
            capture_output=True,
            check=False,
            text=True,
            timeout=8,
        )
    except FileNotFoundError:
        return {
            "available": False,
            "error": "rpicam-hello was not found on PATH.",
        }
    except subprocess.TimeoutExpired as error:
        return {
            "available": True,
            "exitCode": None,
            "stdout": truncate_text(error.stdout),
            "stderr": truncate_text(error.stderr),
            "error": "rpicam-hello --list-cameras timed out.",
        }
    except Exception as error:  # noqa: BLE001
        return {
            "available": False,
            "error": str(error),
        }

    return {
        "available": True,
        "exitCode": completed.returncode,
        "stdout": truncate_text(completed.stdout),
        "stderr": truncate_text(completed.stderr),
    }


def create_tts(*, lang: str | None) -> Any:
    try:
        from robot_hat import TTS

        return TTS(lang=lang)
    except ImportError:
        pass
    except TypeError:
        try:
            from robot_hat import TTS

            tts = TTS()
            if lang is not None:
                set_tts_language(tts=tts, lang=lang)
            return tts
        except ImportError:
            pass

    for module_name, class_name in [
        ("robot_hat.tts", "Pico2Wave"),
        ("sunfounder_voice_assistant.tts", "Pico2Wave"),
    ]:
        tts_class = import_tts_class(module_name=module_name, class_name=class_name)

        if tts_class is None:
            continue

        return tts_class(lang=lang)

    return DirectPico2Wave(lang=lang)


def import_tts_class(*, module_name: str, class_name: str) -> Any | None:
    try:
        module = __import__(module_name, fromlist=[class_name])
    except ImportError:
        return None

    tts_class = getattr(module, class_name, None)

    if tts_class is None:
        return None

    return tts_class


def set_tts_language(*, tts: Any, lang: str) -> None:
    if hasattr(tts, "lang"):
        tts.lang(lang)
        return

    if hasattr(tts, "set_lang"):
        tts.set_lang(lang)
        return

    raise BridgeError("The active TTS engine does not support language changes.")


def run_checked_command(command: list[str], *, context: str) -> None:
    completed = subprocess.run(
        command,
        capture_output=True,
        check=False,
        text=True,
        timeout=20,
    )

    if completed.returncode == 0:
        return

    stderr = completed.stderr.strip()
    stdout = completed.stdout.strip()
    detail = stderr or stdout or f"exit code {completed.returncode}"
    raise BridgeError(f"{context} failed: {detail}")


def camera_check_summary(result: dict[str, Any]) -> str:
    picamera2 = result.get("picamera2")
    rpicam_hello = result.get("rpicamHello")
    parts: list[str] = []

    if isinstance(picamera2, dict):
        count = picamera2.get("cameraCount")

        if isinstance(count, int):
            parts.append(f"Picamera2 reports {count} camera(s).")
        elif isinstance(picamera2.get("error"), str):
            parts.append(f"Picamera2 check failed: {picamera2['error']}.")

    if isinstance(rpicam_hello, dict):
        exit_code = rpicam_hello.get("exitCode")

        if isinstance(exit_code, int):
            parts.append(f"rpicam-hello --list-cameras exited {exit_code}.")
        elif isinstance(rpicam_hello.get("error"), str):
            parts.append(f"rpicam-hello check failed: {rpicam_hello['error']}.")

    return " ".join(parts).strip()


def truncate_text(value: Any, limit: int = 4_000) -> str:
    if value is None:
        return ""

    if isinstance(value, bytes):
        text = value.decode(errors="replace")
    else:
        text = str(value)

    return text if len(text) <= limit else text[:limit] + "\n[truncated]"


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]

    return repr(value)


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


def install_no_sudo_guard() -> None:
    os.popen = guarded_os_popen
    os.system = guarded_os_system
    subprocess.run = guarded_subprocess_run
    subprocess.call = guarded_subprocess_call
    subprocess.check_call = guarded_subprocess_check_call
    subprocess.check_output = guarded_subprocess_check_output
    subprocess.Popen = guarded_subprocess_popen


def guarded_os_popen(command: Any, *args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(command)
    return _ORIGINAL_OS_POPEN(command, *args, **kwargs)


def guarded_os_system(command: Any) -> int:
    reject_sudo_command(command)
    return _ORIGINAL_OS_SYSTEM(command)


def guarded_subprocess_run(*args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(first_subprocess_arg(args=args, kwargs=kwargs))
    return _ORIGINAL_SUBPROCESS_RUN(*args, **kwargs)


def guarded_subprocess_call(*args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(first_subprocess_arg(args=args, kwargs=kwargs))
    return _ORIGINAL_SUBPROCESS_CALL(*args, **kwargs)


def guarded_subprocess_check_call(*args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(first_subprocess_arg(args=args, kwargs=kwargs))
    return _ORIGINAL_SUBPROCESS_CHECK_CALL(*args, **kwargs)


def guarded_subprocess_check_output(*args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(first_subprocess_arg(args=args, kwargs=kwargs))
    return _ORIGINAL_SUBPROCESS_CHECK_OUTPUT(*args, **kwargs)


def guarded_subprocess_popen(*args: Any, **kwargs: Any) -> Any:
    reject_sudo_command(first_subprocess_arg(args=args, kwargs=kwargs))
    return _ORIGINAL_SUBPROCESS_POPEN(*args, **kwargs)


def first_subprocess_arg(*, args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any:
    if len(args) > 0:
        return args[0]

    return kwargs.get("args")


def reject_sudo_command(command: Any) -> None:
    if not starts_with_sudo(command):
        return

    raise BridgeError(NO_SUDO_MESSAGE)


def starts_with_sudo(command: Any) -> bool:
    first_word = command_first_word(command)

    if first_word is None:
        return False

    return Path(first_word).name == "sudo"


def command_first_word(command: Any) -> str | None:
    if isinstance(command, str):
        try:
            words = shlex.split(command)
        except ValueError:
            words = command.strip().split()

        return words[0] if len(words) > 0 else None

    if isinstance(command, (list, tuple)) and len(command) > 0:
        return str(command[0])

    return None


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
