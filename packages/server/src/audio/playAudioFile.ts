import { spawn } from "node:child_process";

export interface PlayAudioFileOptions {
  readonly path: string;
  readonly player?: string;
  readonly timeoutMs?: number;
}

export async function playAudioFile({
  path,
  player = defaultAudioPlayer(),
  timeoutMs,
}: PlayAudioFileOptions): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(player, [path], { stdio: "ignore" });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }

      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    };

    child.once("error", (error) => {
      finish(error);
    });
    child.once("close", (code) => {
      if (code === 0) {
        finish();
        return;
      }
      finish(
        new Error(`Audio player ${player} exited with code ${code ?? "?"}.`),
      );
    });

    if (timeoutMs !== undefined) {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
        finish(
          new Error(
            `Audio player ${player} did not exit within ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);
    }
  });
}

function defaultAudioPlayer(): string {
  if (process.platform === "darwin") {
    return "afplay";
  }
  if (process.platform === "linux") {
    return "aplay";
  }
  throw new Error(
    `No default audio player configured for platform ${process.platform}.`,
  );
}
