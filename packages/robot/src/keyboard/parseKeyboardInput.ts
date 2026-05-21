export type KeyboardAction =
  | {
      readonly type: "motor";
      readonly motorSpeed: number;
    }
  | {
      readonly type: "steering_delta";
      readonly delta: number;
    }
  | {
      readonly type: "camera_delta";
      readonly axis: "pan" | "tilt";
      readonly delta: number;
    }
  | {
      readonly type: "take_photo";
    }
  | {
      readonly type: "say";
      readonly text: string;
    }
  | {
      readonly type: "stop";
    }
  | {
      readonly type: "quit";
    };

export interface ParseKeyboardInputOptions {
  readonly input: string;
  readonly speed: number;
  readonly turnAngle: number;
  readonly cameraStep: number;
}

export function parseKeyboardInput({
  input,
  speed,
  turnAngle,
  cameraStep,
}: ParseKeyboardInputOptions): KeyboardAction[] {
  const actions: KeyboardAction[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === undefined) {
      continue;
    }

    if (character === "\u001b") {
      const sequence = input.slice(index, index + 3);

      if (sequence === "\u001b[A") {
        actions.push({
          type: "motor",
          motorSpeed: speed,
        });
        index += 2;
        continue;
      }

      if (sequence === "\u001b[B") {
        actions.push({
          type: "motor",
          motorSpeed: -speed,
        });
        index += 2;
        continue;
      }

      if (sequence === "\u001b[D") {
        actions.push({
          type: "steering_delta",
          delta: -turnAngle,
        });
        index += 2;
        continue;
      }

      if (sequence === "\u001b[C") {
        actions.push({
          type: "steering_delta",
          delta: turnAngle,
        });
        index += 2;
        continue;
      }

      continue;
    }

    if (character === "\u0003" || character.toLowerCase() === "q") {
      actions.push({ type: "quit" });
      continue;
    }

    if (character === " ") {
      actions.push({ type: "stop" });
      continue;
    }

    if (character.toLowerCase() === "p") {
      actions.push({ type: "take_photo" });
      continue;
    }

    if (character.toLowerCase() === "v") {
      actions.push({
        type: "say",
        text: "hello from Herbert",
      });
      continue;
    }

    if (character.toLowerCase() === "w") {
      actions.push({
        type: "camera_delta",
        axis: "tilt",
        delta: cameraStep,
      });
      continue;
    }

    if (character.toLowerCase() === "s") {
      actions.push({
        type: "camera_delta",
        axis: "tilt",
        delta: -cameraStep,
      });
      continue;
    }

    if (character.toLowerCase() === "a") {
      actions.push({
        type: "camera_delta",
        axis: "pan",
        delta: -cameraStep,
      });
      continue;
    }

    if (character.toLowerCase() === "d") {
      actions.push({
        type: "camera_delta",
        axis: "pan",
        delta: cameraStep,
      });
    }
  }

  return actions;
}
