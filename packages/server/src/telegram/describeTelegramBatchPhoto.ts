import { promptOpenAI } from "@herbert/server/openai";
import type { TelegramPromptBatchReport } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import {
  type RobotTaskBatchPhotoObservation,
  robotTaskBatchPhotoObservationSchema,
} from "@herbert/shared/robotTaskQueue";

export type DescribeTelegramBatchPhoto = typeof describeTelegramBatchPhoto;

export async function describeTelegramBatchPhoto({
  batchReport,
  taskState,
}: {
  readonly batchReport: TelegramPromptBatchReport;
  readonly taskState?: string;
}): Promise<RobotTaskBatchPhotoObservation> {
  return await promptOpenAI({
    prompt: buildBatchPhotoObservationPrompt({ batchReport, taskState }),
    images: [
      {
        path: batchReport.photoPath,
        detail: "high",
        label:
          "Latest robot batch photo to describe for future history. This is the image being summarized.",
      },
    ],
    schema: robotTaskBatchPhotoObservationSchema,
    schemaName: "telegram_batch_photo_observation",
    instructions: telegramBatchPhotoObservationInstructions,
    logType: "telegram_batch_photo_observation",
  });
}

function buildBatchPhotoObservationPrompt({
  batchReport,
  taskState,
}: {
  readonly batchReport: TelegramPromptBatchReport;
  readonly taskState?: string;
}): string {
  return [
    "<task_state>",
    taskState?.trim() || "none",
    "</task_state>",
    "<batch_report>",
    `  <completed_actions>${JSON.stringify(batchReport.actions)}</completed_actions>`,
    ...(batchReport.cameraPosition === undefined
      ? []
      : [
          "  <camera_position>",
          `    <pan>${batchReport.cameraPosition.pan}</pan>`,
          `    <tilt>${batchReport.cameraPosition.tilt}</tilt>`,
          "  </camera_position>",
        ]),
    ...(batchReport.steeringAngle === undefined
      ? []
      : [
          "  <wheel_state>",
          `    <steering_angle>${batchReport.steeringAngle}</steering_angle>`,
          "    <motor_state>stopped_at_batch_boundary</motor_state>",
          "  </wheel_state>",
        ]),
    ...(batchReport.distanceCm === undefined
      ? []
      : [
          `  <ultrasonic_distance_cm>${batchReport.distanceCm}</ultrasonic_distance_cm>`,
        ]),
    "</batch_report>",
  ].join("\n");
}

export const telegramBatchPhotoObservationInstructions = [
  "Describe the attached robot photo for future task history.",
  "Be concise, visual, and operational: what is visible, whether the user target is visible, what open floor or route exists, and what notable objects or visual occlusions are present.",
  "notableObjects are context, not stop conditions. Furniture, chair legs, table frames, plants, cords, and foreground clutter are normal apartment navigation context unless they visibly block the wheel path.",
  "Do not be timid. Prefer descriptions that preserve useful route information and visible open floor instead of overstating ordinary apartment clutter.",
  "Do not invent details beyond the image. If exterior/window detail is washed out or occluded, say so plainly.",
  "Return only the structured JSON object required by the schema.",
].join("\n");
