import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { resolveFloorplanImagePath } from "@herbert/server/telegram/resolveFloorplanImagePath";
import type {
  RobotTaskBatchPhotoObservation,
  RobotTaskFloorplanPositionEstimate,
} from "@herbert/shared/robotTaskQueue";

const floorplanPositionOverlayDirectory = "tmp/herbert-floorplan-overlays";

export interface ResolveFloorplanPromptImagePathOptions {
  readonly position?: RobotTaskFloorplanPositionEstimate;
  readonly baseImagePath?: string;
  readonly outputDirectory?: string;
  readonly rendererPath?: string;
  readonly swiftPath?: string;
}

export function latestFloorplanPositionEstimate({
  batchReports,
}: {
  readonly batchReports?: readonly {
    readonly photoObservation?: RobotTaskBatchPhotoObservation;
  }[];
}): RobotTaskFloorplanPositionEstimate | undefined {
  const reports = batchReports ?? [];

  for (let index = reports.length - 1; index >= 0; index -= 1) {
    const position = reports[index]?.photoObservation?.floorplanPosition;

    if (floorplanPositionHasCoordinates(position)) {
      return position;
    }
  }

  return undefined;
}

export function resolveFloorplanPromptImagePath({
  position,
  baseImagePath = resolveFloorplanImagePath(),
  outputDirectory = floorplanPositionOverlayDirectory,
  rendererPath = defaultRendererPath(),
  swiftPath = "/usr/bin/swift",
}: ResolveFloorplanPromptImagePathOptions = {}): string {
  if (!floorplanPositionHasCoordinates(position)) {
    return baseImagePath;
  }

  try {
    const outputPath = floorplanPositionOverlayPath({
      baseImagePath,
      outputDirectory,
      position,
    });
    if (existsSync(outputPath)) {
      return outputPath;
    }

    mkdirSync(dirname(outputPath), { recursive: true });

    const result = spawnSync(
      swiftPath,
      [
        rendererPath,
        baseImagePath,
        outputPath,
        String(position.xPct),
        String(position.yPct),
        position.confidence,
      ],
      { encoding: "utf8" },
    );

    if (result.error !== undefined) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(
        `floorplan overlay renderer exited with status ${result.status}: ${result.stderr}`,
      );
    }

    return outputPath;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`floorplan position overlay failed: ${message}\n`);
    return baseImagePath;
  }
}

export function floorplanPositionHasCoordinates(
  position: RobotTaskFloorplanPositionEstimate | undefined,
): position is RobotTaskFloorplanPositionEstimate & {
  readonly xPct: number;
  readonly yPct: number;
} {
  return (
    position !== undefined && position.xPct !== null && position.yPct !== null
  );
}

function floorplanPositionOverlayPath({
  baseImagePath,
  outputDirectory,
  position,
}: {
  readonly baseImagePath: string;
  readonly outputDirectory: string;
  readonly position: RobotTaskFloorplanPositionEstimate & {
    readonly xPct: number;
    readonly yPct: number;
  };
}): string {
  const stat = statSync(baseImagePath);
  const baseVersion = `${stat.size}-${Math.floor(stat.mtimeMs)}`;
  return resolve(
    outputDirectory,
    `floorplan-position-${baseVersion}-x${position.xPct}-y${position.yPct}-${position.confidence}.png`,
  );
}

function defaultRendererPath(): string {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    "renderFloorplanOverlay.swift",
  );
}
