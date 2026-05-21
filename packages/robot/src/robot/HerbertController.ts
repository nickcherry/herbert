import { herbertPythonPath } from "@herbert/robot/constants/env";
import { PythonBridgeClient } from "@herbert/robot/python/PythonBridgeClient";
import { clamp } from "@herbert/robot/robot/clamp";
import {
  type BridgeOkResponse,
  cameraAngleLimits,
  cameraAngleSchema,
  motorSpeedSchema,
  speechLanguageSchema,
  speechTextSchema,
  steeringAngleSchema,
  type TakePhotoResult,
  takePhotoResultSchema,
} from "@herbert/shared";

export interface HerbertControllerOptions {
  readonly mock: boolean;
  readonly pythonPath?: string;
  readonly bridgeScriptPath?: string;
  readonly safetyTimeoutMs?: number;
}

export interface CameraDeltaOptions {
  readonly panDelta?: number;
  readonly tiltDelta?: number;
}

export interface CameraPosition {
  readonly pan: number;
  readonly tilt: number;
}

export interface TakePhotoOptions {
  readonly directory?: string;
  readonly name?: string;
}

export interface SayOptions {
  readonly text: string;
  readonly lang?: string;
}

export class HerbertController {
  private cameraPanAngle = 0;
  private cameraTiltAngle = 0;

  private constructor(private readonly bridge: PythonBridgeClient) {}

  public static async create(
    options: HerbertControllerOptions,
  ): Promise<HerbertController> {
    const bridge = await PythonBridgeClient.start({
      pythonPath: options.pythonPath ?? herbertPythonPath,
      scriptPath: options.bridgeScriptPath,
      mock: options.mock,
      safetyTimeoutMs: options.safetyTimeoutMs ?? 750,
    });

    return new HerbertController(bridge);
  }

  public async ping(): Promise<BridgeOkResponse> {
    return await this.bridge.send({ type: "ping" });
  }

  public async setMotor({
    speed,
  }: {
    readonly speed: number;
  }): Promise<BridgeOkResponse> {
    return await this.bridge.send({
      type: "set_motor",
      speed: motorSpeedSchema.parse(speed),
    });
  }

  public async setSteering({
    angle,
  }: {
    readonly angle: number;
  }): Promise<BridgeOkResponse> {
    return await this.bridge.send({
      type: "set_steering",
      angle: steeringAngleSchema.parse(angle),
    });
  }

  public async setCameraPan({
    angle,
  }: {
    readonly angle: number;
  }): Promise<BridgeOkResponse> {
    const parsedAngle = cameraAngleSchema.parse(angle);
    this.cameraPanAngle = parsedAngle;

    return await this.bridge.send({
      type: "set_camera_pan",
      angle: parsedAngle,
    });
  }

  public async setCameraTilt({
    angle,
  }: {
    readonly angle: number;
  }): Promise<BridgeOkResponse> {
    const parsedAngle = cameraAngleSchema.parse(angle);
    this.cameraTiltAngle = parsedAngle;

    return await this.bridge.send({
      type: "set_camera_tilt",
      angle: parsedAngle,
    });
  }

  public getCameraPosition(): CameraPosition {
    return {
      pan: this.cameraPanAngle,
      tilt: this.cameraTiltAngle,
    };
  }

  public async moveCamera({
    panDelta = 0,
    tiltDelta = 0,
  }: CameraDeltaOptions): Promise<CameraPosition> {
    if (panDelta !== 0) {
      await this.setCameraPan({
        angle: clamp({
          value: this.cameraPanAngle + panDelta,
          min: cameraAngleLimits.min,
          max: cameraAngleLimits.max,
        }),
      });
    }

    if (tiltDelta !== 0) {
      await this.setCameraTilt({
        angle: clamp({
          value: this.cameraTiltAngle + tiltDelta,
          min: cameraAngleLimits.min,
          max: cameraAngleLimits.max,
        }),
      });
    }

    return this.getCameraPosition();
  }

  public async takePhoto(
    options: TakePhotoOptions = {},
  ): Promise<TakePhotoResult> {
    const response = await this.bridge.send({
      type: "take_photo",
      ...options,
    });

    return takePhotoResultSchema.parse(response.result);
  }

  public async say({ text, lang }: SayOptions): Promise<BridgeOkResponse> {
    return await this.bridge.send(
      {
        type: "say",
        text: speechTextSchema.parse(text),
        ...(lang === undefined
          ? {}
          : { lang: speechLanguageSchema.parse(lang) }),
      },
      { timeoutMs: speechTimeoutMs({ text }) },
    );
  }

  public async stop(): Promise<BridgeOkResponse> {
    return await this.bridge.send({ type: "stop" });
  }

  public async close(): Promise<void> {
    await this.bridge.close();
  }
}

function speechTimeoutMs({ text }: { readonly text: string }): number {
  return Math.min(60_000, Math.max(10_000, text.length * 250));
}
