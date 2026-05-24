import { z } from "zod";

export const bridgeProtocolVersion = 1;

export const motorSpeedLimits = {
  min: -100,
  max: 100,
} as const;

export const steeringAngleLimits = {
  min: -35,
  max: 35,
} as const;

export const cameraAngleLimits = {
  min: -35,
  max: 35,
} as const;

export const commandIdSchema = z.string().min(1);

export const motorSpeedSchema = z
  .number()
  .int()
  .min(motorSpeedLimits.min)
  .max(motorSpeedLimits.max);

export const steeringAngleSchema = z
  .number()
  .int()
  .min(steeringAngleLimits.min)
  .max(steeringAngleLimits.max);

export const cameraAngleSchema = z
  .number()
  .int()
  .min(cameraAngleLimits.min)
  .max(cameraAngleLimits.max);

export const photoNameSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/);

export const videoFrameWidthSchema = z.number().int().min(160).max(1920);
export const videoFrameHeightSchema = z.number().int().min(120).max(1080);

export const speechTextSchema = z.string().trim().min(1).max(800);

export const speechLanguageSchema = z.enum([
  "en-US",
  "en-GB",
  "zh-CN",
  "de-DE",
  "es-ES",
]);

export const robotCommandPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ping"),
  }),
  z.object({
    type: z.literal("set_motor"),
    speed: motorSpeedSchema,
  }),
  z.object({
    type: z.literal("set_steering"),
    angle: steeringAngleSchema,
  }),
  z.object({
    type: z.literal("set_camera_pan"),
    angle: cameraAngleSchema,
  }),
  z.object({
    type: z.literal("set_camera_tilt"),
    angle: cameraAngleSchema,
  }),
  z.object({
    type: z.literal("stop"),
  }),
  z.object({
    type: z.literal("take_photo"),
    directory: z.string().min(1).optional(),
    name: photoNameSchema.optional(),
  }),
  z.object({
    type: z.literal("capture_frame"),
    width: videoFrameWidthSchema.optional(),
    height: videoFrameHeightSchema.optional(),
  }),
  z.object({
    type: z.literal("camera_check"),
  }),
  z.object({
    type: z.literal("get_distance"),
  }),
  z.object({
    type: z.literal("say"),
    text: speechTextSchema,
    lang: speechLanguageSchema.optional(),
  }),
  z.object({
    type: z.literal("shutdown"),
  }),
]);

export const robotCommandSchema = z.discriminatedUnion("type", [
  z.object({
    id: commandIdSchema,
    type: z.literal("ping"),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("set_motor"),
    speed: motorSpeedSchema,
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("set_steering"),
    angle: steeringAngleSchema,
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("set_camera_pan"),
    angle: cameraAngleSchema,
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("set_camera_tilt"),
    angle: cameraAngleSchema,
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("stop"),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("take_photo"),
    directory: z.string().min(1).optional(),
    name: photoNameSchema.optional(),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("capture_frame"),
    width: videoFrameWidthSchema.optional(),
    height: videoFrameHeightSchema.optional(),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("camera_check"),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("get_distance"),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("say"),
    text: speechTextSchema,
    lang: speechLanguageSchema.optional(),
  }),
  z.object({
    id: commandIdSchema,
    type: z.literal("shutdown"),
  }),
]);

export const bridgeReadyResponseSchema = z.object({
  type: z.literal("ready"),
  protocolVersion: z.literal(bridgeProtocolVersion),
  implementation: z.string().min(1),
  mock: z.boolean(),
});

export const bridgeOkResponseSchema = z.object({
  type: z.literal("ok"),
  id: commandIdSchema,
  result: z.unknown().optional(),
});

export const takePhotoResultSchema = z.object({
  path: z.string().min(1),
});

export const captureFrameResultSchema = z.object({
  imageBase64: z.string().min(1),
  contentType: z.literal("image/jpeg"),
  width: videoFrameWidthSchema,
  height: videoFrameHeightSchema,
  capturedAtMs: z.number().int().nonnegative(),
});

export const getDistanceResultSchema = z.object({
  distanceCm: z.number().finite().nonnegative().nullable(),
});

export const cameraCheckResultSchema = z.object({
  picamera2: z.object({
    available: z.boolean(),
    cameraCount: z.number().int().nonnegative().optional(),
    cameras: z.array(z.unknown()).optional(),
    version: z.string().optional(),
    error: z.string().optional(),
  }),
  rpicamHello: z.object({
    available: z.boolean(),
    exitCode: z.number().int().nullable().optional(),
    stdout: z.string().optional(),
    stderr: z.string().optional(),
    error: z.string().optional(),
  }),
});

export const bridgeErrorResponseSchema = z.object({
  type: z.literal("error"),
  id: commandIdSchema.optional(),
  code: z.string().min(1).optional(),
  message: z.string().min(1),
});

export const bridgeResponseSchema = z.discriminatedUnion("type", [
  bridgeReadyResponseSchema,
  bridgeOkResponseSchema,
  bridgeErrorResponseSchema,
]);

export type RobotCommandPayload = z.infer<typeof robotCommandPayloadSchema>;
export type RobotCommand = z.infer<typeof robotCommandSchema>;
export type BridgeReadyResponse = z.infer<typeof bridgeReadyResponseSchema>;
export type BridgeOkResponse = z.infer<typeof bridgeOkResponseSchema>;
export type BridgeErrorResponse = z.infer<typeof bridgeErrorResponseSchema>;
export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;
export type SpeechLanguage = z.infer<typeof speechLanguageSchema>;
export type TakePhotoResult = z.infer<typeof takePhotoResultSchema>;
export type CaptureFrameResult = z.infer<typeof captureFrameResultSchema>;
export type CameraCheckResult = z.infer<typeof cameraCheckResultSchema>;
export type GetDistanceResult = z.infer<typeof getDistanceResultSchema>;
