import {
  floorplanPositionHasCoordinates,
  latestFloorplanPositionEstimate,
  resolveFloorplanPromptImagePath,
} from "@herbert/server/telegram/resolveFloorplanPromptImagePath";
import { describe, expect, test } from "bun:test";

describe("resolveFloorplanPromptImagePath", () => {
  test("uses the base floorplan when there is no coordinate estimate", () => {
    expect(
      resolveFloorplanPromptImagePath({
        baseImagePath: "/tmp/floorplan.png",
        position: undefined,
      }),
    ).toBe("/tmp/floorplan.png");
    expect(
      resolveFloorplanPromptImagePath({
        baseImagePath: "/tmp/floorplan.png",
        position: {
          xPct: null,
          yPct: null,
          roomId: null,
          confidence: "low",
          rationale: "Too ambiguous to localize.",
        },
      }),
    ).toBe("/tmp/floorplan.png");
  });
});

describe("latestFloorplanPositionEstimate", () => {
  test("selects the most recent stored coordinate estimate", () => {
    const position = latestFloorplanPositionEstimate({
      batchReports: [
        {
          photoObservation: {
            summary: "Unknown view.",
            targetProgress: null,
            navigableSpace: "Unknown.",
            notableObjects: [],
            distanceEstimates: [],
            floorplanPosition: {
              xPct: null,
              yPct: null,
              roomId: null,
              confidence: "low",
              rationale: "Too ambiguous.",
            },
            viewQuality: "poor",
            recommendedNextMove: null,
          },
        },
        {
          photoObservation: {
            summary: "Living room window wall.",
            targetProgress: "The balcony window is visible.",
            navigableSpace: "Open floor ahead.",
            notableObjects: ["sofa"],
            distanceEstimates: [],
            floorplanPosition: {
              xPct: 68,
              yPct: 28,
              roomId: "living_dining",
              confidence: "medium",
              rationale: "The view matches the living dining room.",
            },
            viewQuality: "good",
            recommendedNextMove: "Drive toward the window.",
          },
        },
      ],
    });

    expect(position?.xPct).toBe(68);
    expect(position?.yPct).toBe(28);
  });
});

describe("floorplanPositionHasCoordinates", () => {
  test("requires both xPct and yPct", () => {
    expect(floorplanPositionHasCoordinates(undefined)).toBe(false);
    expect(
      floorplanPositionHasCoordinates({
        xPct: 10,
        yPct: null,
        roomId: "living_dining",
        confidence: "low",
        rationale: "Partial estimate.",
      }),
    ).toBe(false);
    expect(
      floorplanPositionHasCoordinates({
        xPct: 10,
        yPct: 20,
        roomId: "living_dining",
        confidence: "medium",
        rationale: "Complete estimate.",
      }),
    ).toBe(true);
  });
});
