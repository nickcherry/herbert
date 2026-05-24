import { promptOpenAI } from "@herbert/server/openai";
import type { TelegramPromptBatchReport } from "@herbert/server/telegram/buildTelegramOpenAIPrompt";
import {
  type RobotTaskBatchPhotoObservation,
  robotTaskBatchPhotoObservationOpenAISchema,
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
    schema: robotTaskBatchPhotoObservationOpenAISchema,
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

export const telegramBatchPhotoObservationTypeScript = [
  "type TelegramBatchPhotoObservation = {",
  "  summary: string;",
  "  targetProgress: string | null;",
  "  navigableSpace: string;",
  "  notableObjects: string[];",
  "  distanceEstimates: Array<{",
  "    subject: string;",
  '    category: "target" | "route_marker" | "possible_blocker" | "landmark" | "other";',
  "    distanceCm: number | null;",
  '    confidence: "low" | "medium" | "high";',
  "  }>;",
  '  viewQuality: "poor" | "partial" | "good";',
  "  recommendedNextMove: string | null;",
  "};",
].join("\n");

export const telegramBatchPhotoObservationInstructions = [
  "Describe the attached robot photo for future task history.",
  "The expected JSON object is:",
  telegramBatchPhotoObservationTypeScript,
  "Be concise, visual, and operational: what is visible, whether the user target is visible, what open floor or route exists, and what notable objects or visual occlusions are present.",
  "Each text field must be a complete sentence or phrase that stays within the schema limit; do not trail off mid-thought.",
  "notableObjects are context, not stop conditions. Furniture, chair legs, table frames, plants, cords, and foreground clutter are normal apartment navigation context unless they visibly block the wheel path.",
  "Populate distanceEstimates for the requested target when visible, useful route landmarks or openings, and the most relevant possible blockers. Distances are approximate camera-to-subject distances in centimeters; for possible blockers, estimate the nearest visible wheel-path edge.",
  "Use distanceCm: null with low confidence only when the subject is visible but distance cannot be estimated. Prefer an honest low-confidence estimate over omitting a useful target, route marker, or possible blocker.",
  "Use ultrasonic_distance_cm only as a clue for objects in front of Herbert. Do not apply it to side objects or to targets outside the current forward sensor direction.",
  "A near distance estimate is context, not a stop condition. If open floor remains visible around or beyond a possible blocker, preserve that route in navigableSpace and recommendedNextMove.",
  "Do not be timid. Prefer descriptions that preserve useful route information and visible open floor instead of overstating ordinary apartment clutter.",
  "A large object close on one side means side clearance is tight; it does not by itself mean Herbert is boxed in. If floor or target remains visible on the other side, describe the route as a turn-away or arc-away reposition opportunity.",
  "Do not set recommendedNextMove to null just because the current shot is partial, close, or cluttered. Use null only when the requested target is already satisfied or no floor/escape route is visible.",
  "Do not invent details beyond the image. If exterior/window detail is washed out or occluded, say so plainly.",
  "Return only the structured JSON object required by the schema.",
].join("\n");
