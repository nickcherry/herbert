import {
  renderTelegramSessionSummaryHtml,
  selectSessionOpenaiTurns,
} from "@herbert/cli/cli/generateTelegramSessionSummaryHtml";
import type { OpenaiCallLogEntry } from "@herbert/server/persistence/openaiCallLog";
import type { RobotTaskSession } from "@herbert/shared/robotTaskQueue";
import { describe, expect, test } from "bun:test";

describe("generateTelegramSessionSummaryHtml", () => {
  test("selects the initial no-task turn and task-scoped turns for a session", () => {
    const previous = session({
      id: "task_previous",
      createdAtMs: 1_000,
      updatedAtMs: 5_000,
    });
    const current = session({
      id: "task_current",
      createdAtMs: 10_000,
      updatedAtMs: 20_000,
    });
    const next = session({
      id: "task_next",
      createdAtMs: 30_000,
      updatedAtMs: 40_000,
    });

    const selected = selectSessionOpenaiTurns({
      session: current,
      sessions: [previous, current, next],
      entries: [
        entry({
          id: "previous-initial",
          chatId: "101",
          taskId: null,
          createdAtMs: 900,
        }),
        entry({
          id: "current-initial",
          chatId: "101",
          taskId: null,
          createdAtMs: 9_900,
        }),
        entry({
          id: "current-task",
          chatId: "101",
          taskId: "task_current",
          createdAtMs: 15_000,
        }),
        entry({
          id: "next-initial",
          chatId: "101",
          taskId: null,
          createdAtMs: 29_900,
        }),
        entry({
          id: "other-chat",
          chatId: "202",
          taskId: null,
          createdAtMs: 9_950,
        }),
        entry({
          id: "observation",
          type: "telegram_batch_photo_observation",
          chatId: "101",
          taskId: "task_current",
          createdAtMs: 16_000,
        }),
      ],
    });

    expect(selected.map((turn) => turn.id)).toEqual([
      "current-initial",
      "current-task",
    ]);
  });

  test("renders OpenAI turns and robot batch reports into one HTML timeline", () => {
    const current = session({
      id: "task_current",
      createdAtMs: 10_000,
      updatedAtMs: 20_000,
      batchReports: [
        {
          batchId: "batch_1",
          completedAtMs: 15_000,
          photoPath: "/tmp/missing-batch.jpg",
          cameraPosition: { pan: -10, tilt: 25 },
          steeringAngle: -5,
          distanceCm: 42,
          photoObservation: {
            summary: "Window visible beyond furniture.",
            targetProgress: "The balcony window is visible.",
            navigableSpace: "Open floor continues toward the window.",
            notableObjects: ["sofa foreground"],
            viewQuality: "partial",
            recommendedNextMove: "Drive boldly toward the window.",
          },
          actions: [{ type: "take_photo" }],
        },
      ],
    });

    const html = renderTelegramSessionSummaryHtml({
      generatedAtMs: 25_000,
      session: current,
      turns: [
        entry({
          id: "turn_1",
          chatId: "101",
          taskId: "task_current",
          createdAtMs: 11_000,
          prompt: [
            "<turn_context>",
            "  <trigger>telegram_messages</trigger>",
            "</turn_context>",
            "<user_messages>",
            "  <message>",
            "    <sender>Nick</sender>",
            "    <text>show me the balcony window</text>",
            "    <timestamp>2026-05-23 12:00:00</timestamp>",
            "    <is_new>1</is_new>",
            "  </message>",
            "</user_messages>",
          ].join("\n"),
          responseJson: JSON.stringify({
            telegramMessage: null,
            spokenMessage: null,
            taskState: "Pursuing the balcony window.",
            isFinished: false,
            actions: [
              {
                type: "drive",
                direction: "forward",
                speed: 95,
                durationMs: 4000,
              },
            ],
          }),
          imagePaths: ["/tmp/missing-floorplan.png", "/tmp/missing-batch.jpg"],
        }),
      ],
    });

    expect(html).toContain("OpenAI Turn 1");
    expect(html).toContain("Robot Batch 1");
    expect(html).toContain("show me the balcony window");
    expect(html).toContain("Pursuing the balcony window.");
    expect(html).toContain("Window visible beyond furniture.");
    expect(html).toContain("sofa foreground");
    expect(html).toContain("-5 deg");
    expect(html).toContain("Full Prompt");
  });
});

function session({
  id,
  createdAtMs,
  updatedAtMs,
  batchReports = [],
}: {
  readonly id: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly batchReports?: RobotTaskSession["batchReports"];
}): RobotTaskSession {
  return {
    id,
    chatId: "101",
    status: "finished",
    createdAtMs,
    updatedAtMs,
    taskState: `Task state for ${id}.`,
    batchReports,
  };
}

function entry({
  id,
  createdAtMs,
  type = "telegram_robot_turn",
  chatId,
  taskId,
  prompt = "<turn_context><trigger>batch_complete</trigger></turn_context>",
  imagePaths = [],
  responseJson = JSON.stringify({
    telegramMessage: null,
    spokenMessage: null,
    taskState: "Still working.",
    isFinished: false,
    actions: [{ type: "take_photo" }],
  }),
}: {
  readonly id: string;
  readonly createdAtMs: number;
  readonly type?: string;
  readonly chatId: string | null;
  readonly taskId: string | null;
  readonly prompt?: string;
  readonly imagePaths?: readonly string[];
  readonly responseJson?: string | null;
}): OpenaiCallLogEntry {
  return {
    id,
    createdAtMs,
    type,
    model: "gpt-test",
    schemaName: "telegram_robot_response",
    chatId,
    taskId,
    instructions: "Return JSON only.",
    prompt,
    imagePaths,
    responseJson,
    errorMessage: null,
    latencyMs: 123,
    inputTokens: 10,
    outputTokens: 20,
  };
}
