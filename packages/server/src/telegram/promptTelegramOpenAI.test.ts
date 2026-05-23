import { telegramOpenAIInstructions } from "@herbert/server/telegram/promptTelegramOpenAI";
import { describe, expect, test } from "bun:test";

describe("telegramOpenAIInstructions", () => {
  test("organizes guidance into nested top-level XML sections", () => {
    for (const tag of [
      "<role>",
      "  <identity>",
      "  <voice>",
      "  <prime_directive>",
      "    <precision>",
      "    <show_requests>",
      "<turn>",
      "  <triggers>",
      "  <state>",
      "    <images>",
      "      <floorplan>",
      "      <batch_photos>",
      "<actions>",
      "  <inventory>",
      "  <limits>",
      "  <distance_estimates>",
      "  <composition>",
      "<movement_policy>",
      "  <bias>",
      "  <hazards>",
      "  <user_overrides>",
      "  <below_minimum_drive>",
      "<response>",
      "  <format>",
      "  <fields>",
      "  <action_requirement>",
      "<special_commands>",
    ]) {
      expect(telegramOpenAIInstructions).toContain(tag);
    }
  });

  test("requires precise, evidence-grounded answers and full-frame show shots", () => {
    expect(telegramOpenAIInstructions).toContain("thoroughly and precisely");
    expect(telegramOpenAIInstructions).toContain(
      "robot photos and batch reports actually present",
    );
    expect(telegramOpenAIInstructions).toContain(
      "floorplan only for static layout",
    );
    expect(telegramOpenAIInstructions).toContain("Do not guess");
    expect(telegramOpenAIInstructions).toContain("the deliverable is a photo");
    expect(telegramOpenAIInstructions).toContain("whole subject is captured");
  });

  test("encodes the updated hard movement limits and a distance_estimates block", () => {
    expect(telegramOpenAIInstructions).toContain("<speed>50 to 100");
    expect(telegramOpenAIInstructions).toContain("<duration_ms>1000 to 5000");
    expect(telegramOpenAIInstructions).toContain("<distance_estimates>");
    expect(telegramOpenAIInstructions).toContain(
      "distance_cm ~= 50 * (speed / 100) * (durationMs / 1000)",
    );
    expect(telegramOpenAIInstructions).toContain("250 cm (maximum)");
  });

  test("describes action composition with drive_arc preference", () => {
    expect(telegramOpenAIInstructions).toContain("<composition>");
    expect(telegramOpenAIInstructions).toContain("prefer drive_arc");
    expect(telegramOpenAIInstructions).toContain("turn while moving");
  });

  test("encodes the action-required-each-turn rule with its exceptions", () => {
    expect(telegramOpenAIInstructions).toContain("<action_requirement>");
    expect(telegramOpenAIInstructions).toContain(
      "Every turn MUST queue at least one action",
    );
    expect(telegramOpenAIInstructions).toContain("isFinished is true");
    expect(telegramOpenAIInstructions).toContain("blocking question");
  });

  test("requires JSON only and includes the exact TypeScript response shape", () => {
    expect(telegramOpenAIInstructions).toContain("Return JSON only");
    expect(telegramOpenAIInstructions).toContain(
      "type TelegramOpenAIResponse = {",
    );
    expect(telegramOpenAIInstructions).toContain(
      "telegramMessage: string | null;",
    );
    expect(telegramOpenAIInstructions).toContain("isFinished: boolean;");
    expect(telegramOpenAIInstructions).toContain('type: "drive_arc";');
    expect(telegramOpenAIInstructions).toContain("angle: number;");
    expect(telegramOpenAIInstructions).not.toContain("<telegram_message>");
    expect(telegramOpenAIInstructions).not.toContain("is_finished");
  });

  test("keeps spoken-message guidance terse and delay-aware", () => {
    expect(telegramOpenAIInstructions).toContain("<spokenMessage>");
    expect(telegramOpenAIInstructions).toContain("5-10 seconds");
    expect(telegramOpenAIInstructions).toContain("800 chars");
  });

  test("drops content that is not real functionality", () => {
    expect(telegramOpenAIInstructions).not.toContain("Summarize older history");
    expect(telegramOpenAIInstructions).not.toContain("Hedged language");
    expect(telegramOpenAIInstructions).not.toContain("Stepping BACK");
    expect(telegramOpenAIInstructions).not.toContain("ultrasonic_distance_cm");
    expect(telegramOpenAIInstructions).not.toContain("pompousness");
    expect(telegramOpenAIInstructions).not.toContain("Victorian theatre");
    expect(telegramOpenAIInstructions).not.toContain("smugness");
    expect(telegramOpenAIInstructions).not.toContain("anxiety");
    expect(telegramOpenAIInstructions).not.toContain("fussiness");
  });
});
