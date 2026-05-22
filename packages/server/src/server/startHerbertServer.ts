import { env } from "@herbert/server/constants/env";
import { serverConfig } from "@herbert/server/constants/server";
import { telegramConfig } from "@herbert/server/constants/telegram";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { abandonPendingRobotTaskWork } from "@herbert/server/robotTasks/robotTaskStore";
import { createServerFetch } from "@herbert/server/server/createServerFetch";
import { startTelegramPolling } from "@herbert/server/telegram/runTelegramMonitor";
import pc from "picocolors";

export interface StartHerbertServerOptions {
  readonly host?: string;
  readonly port?: number;
  readonly telegramPolling?: boolean;
  readonly store?: DocumentStore;
  readonly sweepPendingRobotTaskWork?: boolean;
}

export interface HerbertServerHandle {
  readonly server: Bun.Server<undefined>;
  readonly url: string;
  readonly telegramPolling: boolean;
  readonly stop: () => Promise<void>;
}

export async function startHerbertServer({
  host = serverConfig.host,
  port = serverConfig.port,
  telegramPolling = true,
  store,
  sweepPendingRobotTaskWork = true,
}: StartHerbertServerOptions = {}): Promise<HerbertServerHandle> {
  if (telegramPolling) {
    requireOpenAIApiKey();
  }

  if (sweepPendingRobotTaskWork) {
    const sweep = await abandonPendingRobotTaskWork({ store });
    if (sweep.abandonedBatchCount > 0 || sweep.finishedSessionCount > 0) {
      process.stdout.write(
        `${pc.bold("server")} abandoned ${sweep.abandonedBatchCount} pending robot batch(es) and finished ${sweep.finishedSessionCount} active task session(s) from a prior run\n`,
      );
    }
  }

  const telegramHandle = telegramPolling
    ? startTelegramPolling({
        botToken: requireTelegramBotToken(),
        adminChatIds: requireTelegramAdminChatIds(),
        timeoutSeconds: telegramConfig.longPollTimeoutSeconds,
        limit: telegramConfig.pollLimit,
        coldPollIntervalMs: telegramConfig.coldPollIntervalMs,
        activePollIntervalMs: telegramConfig.activePollIntervalMs,
        activePollWindowMs: telegramConfig.activePollWindowMs,
        once: false,
        store,
      })
    : undefined;

  telegramHandle?.done.catch((error: unknown) => {
    process.stderr.write(
      `${pc.red(pc.bold("telegram"))} polling stopped: ${formatError(error)}\n`,
    );
  });

  const server = Bun.serve({
    hostname: host,
    port,
    fetch: createServerFetch({
      telegramBotToken: env.telegramBotToken,
      telegramAdminChatIds: env.telegramAdminChatIds,
      store,
    }),
  });

  return {
    server,
    url: localUrlForServer({ server }),
    telegramPolling,
    async stop() {
      await telegramHandle?.stop();
      await server.stop(true);
    },
  };
}

function requireTelegramBotToken(): string {
  const botToken = env.telegramBotToken;

  if (botToken === undefined) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in the environment.");
  }

  return botToken;
}

function requireTelegramAdminChatIds(): readonly string[] {
  const chatIds = env.telegramAdminChatIds;

  if (chatIds.length === 0) {
    throw new Error("TELEGRAM_ADMIN_CHAT_IDS is not set in the environment.");
  }

  return chatIds;
}

function requireOpenAIApiKey(): string {
  const apiKey = env.openaiApiKey;

  if (apiKey === undefined) {
    throw new Error("OPENAI_API_KEY is not set in the environment.");
  }

  return apiKey;
}

function localUrlForServer({
  server,
}: {
  readonly server: Bun.Server<undefined>;
}): string {
  const port = server.port;

  if (port === undefined) {
    return server.url.href;
  }

  return `http://127.0.0.1:${port}`;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
