import {
  executableTelegramOpenAIResponseSchema,
  telegramOpenAIResponseSchema,
} from "@herbert/server/telegram/telegramOpenAIResponse";
import { describe, expect, test } from "bun:test";
import { zodTextFormat } from "openai/helpers/zod";

describe("telegramOpenAIResponseSchema", () => {
  test("accepts bounded movement actions", () => {
    expect(
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: "Driving forward.",
        spokenMessage: "Careful little scoot.",
        taskState: "Moving forward to improve Herbert's view.",
        isFinished: false,
        actions: [
          {
            type: "drive",
            direction: "forward",
            speed: 35,
            durationMs: 250,
          },
          {
            type: "drive_arc",
            direction: "backward",
            angle: -15,
            speed: 20,
            durationMs: 300,
          },
          {
            type: "set_steering",
            angle: 0,
          },
        ],
      }),
    ).toEqual({
      telegramMessage: "Driving forward.",
      spokenMessage: "Careful little scoot.",
      taskState: "Moving forward to improve Herbert's view.",
      isFinished: false,
      actions: [
        {
          type: "drive",
          direction: "forward",
          speed: 35,
          durationMs: 250,
        },
        {
          type: "drive_arc",
          direction: "backward",
          angle: -15,
          speed: 20,
          durationMs: 300,
        },
        {
          type: "set_steering",
          angle: 0,
        },
      ],
    });
  });

  test("rejects robot parameters outside the OpenAI action limits", () => {
    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: "Too fast.",
        spokenMessage: null,
        taskState: "Testing invalid speed.",
        isFinished: false,
        actions: [
          {
            type: "drive",
            direction: "forward",
            speed: 51,
            durationMs: 250,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: "Too much steering.",
        spokenMessage: null,
        taskState: "Testing invalid steering.",
        isFinished: false,
        actions: [
          {
            type: "set_steering",
            angle: 31,
          },
        ],
      }),
    ).toThrow();
  });

  test("post-validates Telegram reply text limits", () => {
    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: "",
        spokenMessage: null,
        taskState: "Testing empty Telegram message.",
        isFinished: true,
        actions: [],
      }),
    ).toThrow();
  });

  test("rejects finished responses with more actions", () => {
    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: null,
        spokenMessage: null,
        taskState: "The task is finished.",
        isFinished: true,
        actions: [
          {
            type: "take_photo",
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects speech actions from Telegram", () => {
    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        telegramMessage: "Speech is not a Telegram action.",
        spokenMessage: null,
        taskState: "Testing invalid speech action.",
        isFinished: false,
        actions: [
          {
            type: "say",
            text: "hello",
          },
        ],
      }),
    ).toThrow();
  });

  test("emits OpenAI-compatible nested anyOf instead of oneOf", () => {
    const textFormat = zodTextFormat(
      telegramOpenAIResponseSchema,
      "telegram_robot_response",
    );
    const schemaJson = JSON.stringify(textFormat.schema);

    expect(schemaJson).toContain('"anyOf"');
    expect(schemaJson).not.toContain('"say"');
    expect(schemaJson).not.toContain('"oneOf"');
    expect(schemaJson).not.toContain('"minLength"');
    expect(schemaJson).not.toContain('"maxLength"');
  });
});
