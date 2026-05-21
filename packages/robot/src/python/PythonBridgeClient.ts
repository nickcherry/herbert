import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

import { resolveBridgeScriptPath } from "@herbert/robot/python/resolveBridgeScriptPath";
import {
  type BridgeErrorResponse,
  bridgeErrorResponseSchema,
  type BridgeOkResponse,
  type BridgeReadyResponse,
  bridgeResponseSchema,
  type RobotCommandPayload,
  robotCommandPayloadSchema,
  robotCommandSchema,
} from "@herbert/shared";

interface PendingCommand {
  readonly resolve: (response: BridgeOkResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
}

export interface PythonBridgeClientOptions {
  readonly pythonPath: string;
  readonly scriptPath?: string;
  readonly mock: boolean;
  readonly safetyTimeoutMs: number;
  readonly startupTimeoutMs?: number;
  readonly commandTimeoutMs?: number;
}

export class PythonBridgeClient {
  private child: ChildProcessWithoutNullStreams | undefined;
  private stdoutInterface: Interface | undefined;
  private stderrInterface: Interface | undefined;
  private commandCounter = 0;
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readySettled = false;
  private closing = false;
  private readonly readyPromise: Promise<BridgeReadyResponse>;
  private readyResolve: ((response: BridgeReadyResponse) => void) | undefined;
  private readyReject: ((error: Error) => void) | undefined;

  private constructor(
    private readonly options: Required<PythonBridgeClientOptions>,
  ) {
    this.readyPromise = new Promise<BridgeReadyResponse>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
  }

  public static async start(
    options: PythonBridgeClientOptions,
  ): Promise<PythonBridgeClient> {
    const client = new PythonBridgeClient({
      pythonPath: options.pythonPath,
      scriptPath: options.scriptPath ?? resolveBridgeScriptPath(),
      mock: options.mock,
      safetyTimeoutMs: options.safetyTimeoutMs,
      startupTimeoutMs: options.startupTimeoutMs ?? 5_000,
      commandTimeoutMs: options.commandTimeoutMs ?? 2_000,
    });

    client.startProcess();
    await client.waitUntilReady();
    return client;
  }

  public async send(
    payload: RobotCommandPayload,
    options: { readonly timeoutMs?: number } = {},
  ): Promise<BridgeOkResponse> {
    if (this.child === undefined) {
      throw new Error("Python bridge is not running.");
    }

    if (this.child.stdin.destroyed) {
      throw new Error("Python bridge stdin is closed.");
    }

    const command = robotCommandSchema.parse({
      id: this.nextCommandId(),
      ...robotCommandPayloadSchema.parse(payload),
    });

    const timeoutMs = options.timeoutMs ?? this.options.commandTimeoutMs;

    return await new Promise<BridgeOkResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(command.id);
        reject(new Error(`Python bridge timed out on ${command.type}.`));
      }, timeoutMs);

      this.pendingCommands.set(command.id, {
        resolve,
        reject,
        timeout,
      });

      this.child?.stdin.write(`${JSON.stringify(command)}\n`, (error) => {
        if (error === null || error === undefined) {
          return;
        }

        clearTimeout(timeout);
        this.pendingCommands.delete(command.id);
        reject(error);
      });
    });
  }

  public async close(): Promise<void> {
    if (this.child === undefined) {
      return;
    }

    if (this.child.exitCode === null && !this.closing) {
      try {
        await this.send({ type: "shutdown" }, { timeoutMs: 1_000 });
      } catch {
        // The process may already be exiting after an error or signal.
      }
    }

    this.closing = true;
    this.child.stdin.end();

    if (this.child.exitCode !== null) {
      this.closeInterfaces();
      return;
    }

    await new Promise<void>((resolve) => {
      const killTimeout = setTimeout(() => {
        this.child?.kill();
        resolve();
      }, 1_000);

      this.child?.once("close", () => {
        clearTimeout(killTimeout);
        resolve();
      });
    });

    this.closeInterfaces();
  }

  private startProcess(): void {
    const args = [
      this.options.scriptPath,
      "--safety-timeout-ms",
      String(this.options.safetyTimeoutMs),
    ];

    if (this.options.mock) {
      args.push("--mock");
    }

    this.child = spawn(this.options.pythonPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.stdoutInterface = createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity,
    });

    this.stderrInterface = createInterface({
      input: this.child.stderr,
      crlfDelay: Infinity,
    });

    this.stdoutInterface.on("line", (line) => this.handleStdoutLine(line));
    this.stderrInterface.on("line", (line) => {
      process.stderr.write(`[herbert-python] ${line}\n`);
    });

    this.child.once("error", (error) => this.handleProcessError(error));
    this.child.once("close", (code, signal) =>
      this.handleProcessClose(code, signal),
    );
  }

  private async waitUntilReady(): Promise<BridgeReadyResponse> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<BridgeReadyResponse>((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Python bridge did not become ready in time."));
      }, this.options.startupTimeoutMs);
    });

    try {
      return await Promise.race([this.readyPromise, timeoutPromise]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private handleStdoutLine(line: string): void {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(line);
    } catch (error) {
      this.rejectReadyIfPending(
        error instanceof Error
          ? error
          : new Error(`Invalid bridge JSON: ${String(error)}`),
      );
      process.stderr.write(`[herbert-python] invalid json: ${line}\n`);
      return;
    }

    const parseResult = bridgeResponseSchema.safeParse(parsedJson);

    if (!parseResult.success) {
      this.rejectReadyIfPending(new Error(parseResult.error.message));
      process.stderr.write(
        `[herbert-python] invalid response: ${parseResult.error.message}\n`,
      );
      return;
    }

    const response = parseResult.data;

    if (response.type === "ready") {
      this.readySettled = true;
      this.readyResolve?.(response);
      return;
    }

    if (response.type === "ok") {
      const pending = this.pendingCommands.get(response.id);

      if (pending === undefined) {
        return;
      }

      clearTimeout(pending.timeout);
      this.pendingCommands.delete(response.id);
      pending.resolve(response);
      return;
    }

    this.handleBridgeError(response);
  }

  private handleBridgeError(response: BridgeErrorResponse): void {
    const error = bridgeErrorToError(response);

    if (response.id === undefined) {
      this.rejectReadyIfPending(error);
      process.stderr.write(`[herbert-python] ${error.message}\n`);
      return;
    }

    const pending = this.pendingCommands.get(response.id);

    if (pending === undefined) {
      process.stderr.write(`[herbert-python] ${error.message}\n`);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(response.id);
    pending.reject(error);
  }

  private handleProcessError(error: Error): void {
    this.rejectReadyIfPending(error);
    this.rejectPendingCommands(error);
  }

  private handleProcessClose(
    code: number | null,
    signal: NodeJS.Signals | null,
  ): void {
    this.closeInterfaces();

    if (this.closing) {
      return;
    }

    const reason =
      signal === null
        ? `Python bridge exited with code ${String(code)}.`
        : `Python bridge exited from signal ${signal}.`;

    const error = new Error(reason);
    this.rejectReadyIfPending(error);
    this.rejectPendingCommands(error);
  }

  private rejectReadyIfPending(error: Error): void {
    if (this.readySettled) {
      return;
    }

    this.readySettled = true;
    this.readyReject?.(error);
  }

  private rejectPendingCommands(error: Error): void {
    for (const [id, pending] of this.pendingCommands.entries()) {
      clearTimeout(pending.timeout);
      this.pendingCommands.delete(id);
      pending.reject(error);
    }
  }

  private nextCommandId(): string {
    this.commandCounter += 1;
    return `cmd-${this.commandCounter}`;
  }

  private closeInterfaces(): void {
    this.stdoutInterface?.close();
    this.stderrInterface?.close();
  }
}

function bridgeErrorToError(response: BridgeErrorResponse): Error {
  const parsed = bridgeErrorResponseSchema.parse(response);
  return new Error(`[${parsed.code ?? "bridge_error"}] ${parsed.message}`);
}
