import { z } from "zod";

export const robotPhotoUploadPath = "/robot/photos";
export const robotActionBatchPollPath = "/robot/action-batches/next";
export const robotActionBatchCompletePath = "/robot/action-batches/complete";

export const robotPhotoUploadResponseSchema = z.object({
  ok: z.literal(true),
  messageIds: z.array(z.number().int()),
});

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
  message: z.string().min(1).optional(),
});

export type RobotPhotoUploadResponse = z.infer<
  typeof robotPhotoUploadResponseSchema
>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
