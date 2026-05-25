import {
  cameraAngleLimits,
  motorSpeedLimits,
  steeringAngleLimits,
} from "@herbert/shared/commands";
import { z } from "zod";

export const robotPhotoUploadPath = "/robot/photos";
export const robotVideoFrameUploadPath = "/robot/video/frames";
export const webControlCommandPath = "/control";
export const robotControlNextPath = "/robot/control/next";
export const robotControlStatusPath = "/robot/control/status";
export const videoLatestFramePath = "/video/latest.jpg";
export const videoMjpegPath = "/video.mjpeg";
export const videoStatusPath = "/video/status";

export const robotPhotoUploadResponseSchema = z.object({
  ok: z.literal(true),
  messageIds: z.array(z.number().int()),
});

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
  message: z.string().min(1).optional(),
});

export const videoFrameUploadResponseSchema = z.object({
  ok: z.literal(true),
  frameId: z.number().int().positive(),
  receivedAtMs: z.number().int().nonnegative(),
  subscriberCount: z.number().int().nonnegative(),
});

export const videoStatusResponseSchema = z.object({
  ok: z.literal(true),
  hasFrame: z.boolean(),
  frameId: z.number().int().positive().nullable(),
  capturedAtMs: z.number().int().nonnegative().nullable(),
  receivedAtMs: z.number().int().nonnegative().nullable(),
  ageMs: z.number().int().nonnegative().nullable(),
  contentType: z.string().min(1).nullable(),
  byteLength: z.number().int().nonnegative().nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  subscriberCount: z.number().int().nonnegative(),
});

export const remoteControlCommandSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("drive"),
    direction: z.enum(["forward", "backward"]),
    speed: z.number().int().min(1).max(motorSpeedLimits.max),
    durationMs: z.number().int().min(50).max(3_000),
  }),
  z.object({
    type: z.literal("steer"),
    delta: z
      .number()
      .int()
      .min(steeringAngleLimits.min)
      .max(steeringAngleLimits.max),
  }),
  z.object({
    type: z.literal("camera"),
    axis: z.enum(["pan", "tilt"]),
    delta: z
      .number()
      .int()
      .min(cameraAngleLimits.min)
      .max(cameraAngleLimits.max),
  }),
  z.object({
    type: z.literal("stop"),
  }),
  z.object({
    type: z.literal("center"),
  }),
]);

const remoteControlCommandMetadataSchema = z.object({
  id: z.string().min(1),
  createdAtMs: z.number().int().nonnegative(),
});

export const remoteControlQueuedCommandSchema = z.discriminatedUnion("type", [
  remoteControlCommandMetadataSchema.extend({
    type: z.literal("drive"),
    direction: z.enum(["forward", "backward"]),
    speed: z.number().int().min(1).max(motorSpeedLimits.max),
    durationMs: z.number().int().min(50).max(3_000),
  }),
  remoteControlCommandMetadataSchema.extend({
    type: z.literal("steer"),
    delta: z
      .number()
      .int()
      .min(steeringAngleLimits.min)
      .max(steeringAngleLimits.max),
  }),
  remoteControlCommandMetadataSchema.extend({
    type: z.literal("camera"),
    axis: z.enum(["pan", "tilt"]),
    delta: z
      .number()
      .int()
      .min(cameraAngleLimits.min)
      .max(cameraAngleLimits.max),
  }),
  remoteControlCommandMetadataSchema.extend({
    type: z.literal("stop"),
  }),
  remoteControlCommandMetadataSchema.extend({
    type: z.literal("center"),
  }),
]);

export const webControlCommandResponseSchema = z.object({
  ok: z.literal(true),
  command: remoteControlQueuedCommandSchema,
  queueDepth: z.number().int().nonnegative(),
});

export const robotControlNextResponseSchema = z.object({
  ok: z.literal(true),
  command: remoteControlQueuedCommandSchema.nullable(),
});

export const robotControlStatusResponseSchema = z.object({
  ok: z.literal(true),
  queueDepth: z.number().int().nonnegative(),
  nextCommandId: z.string().min(1).nullable(),
  issuedCount: z.number().int().nonnegative(),
});

export type RobotPhotoUploadResponse = z.infer<
  typeof robotPhotoUploadResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
export type VideoFrameUploadResponse = z.infer<
  typeof videoFrameUploadResponseSchema
>;
export type VideoStatusResponse = z.infer<typeof videoStatusResponseSchema>;
export type RemoteControlCommand = z.infer<typeof remoteControlCommandSchema>;
export type RemoteControlQueuedCommand = z.infer<
  typeof remoteControlQueuedCommandSchema
>;
export type WebControlCommandResponse = z.infer<
  typeof webControlCommandResponseSchema
>;
export type RobotControlNextResponse = z.infer<
  typeof robotControlNextResponseSchema
>;
export type RobotControlStatusResponse = z.infer<
  typeof robotControlStatusResponseSchema
>;
