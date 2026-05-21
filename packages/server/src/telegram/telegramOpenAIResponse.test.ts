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
        message: "Driving forward.",
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
      message: "Driving forward.",
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
        message: "Too fast.",
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
        message: "Too much steering.",
        actions: [
          {
            type: "set_steering",
            angle: 31,
          },
        ],
      }),
    ).toThrow();
  });

  test("post-validates Telegram and speech text limits", () => {
    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        message: "",
        actions: [],
      }),
    ).toThrow();

    expect(() =>
      executableTelegramOpenAIResponseSchema.parse({
        message: "I will say it.",
        actions: [
          {
            type: "say",
            text: "x".repeat(301),
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
    expect(schemaJson).not.toContain('"oneOf"');
    expect(schemaJson).not.toContain('"minLength"');
    expect(schemaJson).not.toContain('"maxLength"');
  });
});
