import { spawn } from "node:child_process";

export interface PlayAudioFileOptions {
  readonly path: string;
  readonly player?: string;
}

export async function playAudioFile({
  path,
  player = defaultAudioPlayer(),
}: PlayAudioFileOptions): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(player, [path], { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Audio player ${player} exited with code ${code ?? "?"}.`));
    });
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
