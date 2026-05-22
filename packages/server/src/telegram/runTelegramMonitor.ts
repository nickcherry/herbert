import { env } from "@herbert/server/constants/env";
import { telegramConfig } from "@herbert/server/constants/telegram";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { handleRobotTaskResponse } from "@herbert/server/robotTasks/handleRobotTaskResponse";
import { readRobotTaskContext } from "@herbert/server/robotTasks/robotTaskStore";
import { authorizeTelegramMessage } from "@herbert/server/telegram/authorizeTelegramMessage";
import { extractTelegramMessages } from "@herbert/server/telegram/extractTelegramMessages";
import {
  getTelegramUpdates,
  type GetTelegramUpdatesParams,
  type GetTelegramUpdatesResult,
} from "@herbert/server/telegram/getTelegramUpdates";
import { promptTelegramOpenAI } from "@herbert/server/telegram/promptTelegramOpenAI";
import {
  sendTelegramMessage,
  type SendTelegramMessageParams,
  type SendTelegramMessageResult,
} from "@herbert/server/telegram/sendTelegramMessage";
import type { TelegramState } from "@herbert/server/telegram/state/telegramState";
import {
  readTelegramState,
  writeTelegramState,
} from "@herbert/server/telegram/state/telegramStateStore";
import {
  appendTelegramMessageHistoryBatch,
  filterRecentTelegramMessages,
  readTelegramMessageHistory,
  type TelegramHistoryMessage,
  telegramHistoryMessageFromTelegram,
} from "@herbert/server/telegram/telegramMessageHistory";
import type { TelegramOpenAIResponse } from "@herbert/server/telegram/telegramOpenAIResponse";
import pc from "picocolors";

export type GetTelegramUpdates = (
  options: GetTelegramUpdatesParams,
) => Promise<GetTelegramUpdatesResult>;

export type SendTelegramMessage = (
  options: SendTelegramMessageParams,
) => Promise<SendTelegramMessageResult>;

export type RespondToTelegramMessage = typeof promptTelegramOpenAI;

export interface TelegramMonitorOptions {
  readonly botToken: string;
  readonly adminChatIds: readonly string[];
  readonly timeoutSeconds: number;
  readonly limit: number;
  readonly coldPollIntervalMs: number;
  readonly activePollIntervalMs: number;
  readonly activePollWindowMs: number;
  readonly once: boolean;
  readonly store?: DocumentStore;
  readonly getUpdates?: GetTelegramUpdates;
  readonly sendMessage?: SendTelegramMessage;
  readonly respondToMessage?: RespondToTelegramMessage;
}

export interface TelegramPollingHandle {
  readonly done: Promise<void>;
  readonly stop: () => Promise<void>;
}

export function startTelegramPolling({
  botToken,
  adminChatIds,
  timeoutSeconds,
  limit,
  coldPollIntervalMs,
  activePollIntervalMs,
  activePollWindowMs,
  once,
  store,
  getUpdates = getTelegramUpdates,
  sendMessage = sendTelegramMessage,
  respondToMessage = promptTelegramOpenAI,
}: TelegramMonitorOptions): TelegramPollingHandle {
  if (adminChatIds.length === 0) {
    throw new Error("TELEGRAM_ADMIN_CHAT_IDS is not set in the environment.");
  }

  const abortController = new AbortController();
  let shouldStop = false;

  const done = runLoop();

  return {
    done,
    async stop() {
      shouldStop = true;
      abortController.abort();
      await done;
    },
  };

  async function runLoop(): Promise<void> {
    let state = await readTelegramState({ store });
    let offset = state.nextUpdateOffset;

    do {
      try {
        const result = await getUpdates({
          botToken,
          offset,
          timeoutSeconds,
          limit,
          signal: abortController.signal,
        });

        let receivedMessage = false;

        for (const update of result.updates) {
          offset = update.update_id + 1;
        }

        const newMessagesByChatId = new Map<string, TelegramHistoryMessage[]>();

        for (const message of extractTelegramMessages({
          updates: result.updates,
        })) {
          receivedMessage = true;
          const authorization = authorizeTelegramMessage({
            message,
            adminChatIds,
          });

          if (!authorization.authorized) {
            process.stderr.write(
              `${pc.yellow(pc.bold("telegram"))} ignored ${formatKeyValue({
                key: "chat",
                value: authorization.chatId,
              })}: ${authorization.reason}\n`,
            );
            continue;
          }

          process.stdout.write(
            `${pc.bold("telegram")} ${formatKeyValue({
              key: "chat",
              value: authorization.chatId,
            })} ${formatKeyValue({
              key: "text",
              value: JSON.stringify(authorization.text),
            })}\n`,
          );

          const currentMessage = telegramHistoryMessageFromTelegram({
            message: authorization.message,
            text: authorization.text,
          });
          const newMessages =
            newMessagesByChatId.get(authorization.chatId) ?? [];
          newMessages.push(currentMessage);
          newMessagesByChatId.set(authorization.chatId, newMessages);
        }

        for (const [chatId, newMessages] of newMessagesByChatId) {
          const taskContext = await readRobotTaskContext({
            chatId,
            store,
          });
          const recentMessages = filterRecentTelegramMessages({
            messages: await readTelegramMessageHistory({
              chatId,
              store,
            }),
            maxAgeMs: telegramConfig.openAIContextMessageMaxAgeMs,
          });
          const response = await respondToMessage({
            recentMessages,
            newMessages,
            turnTrigger: "telegram_messages",
            taskState: taskContext.session?.taskState,
            commentary: taskContext.session?.commentary,
          });

          logTelegramOpenAIResponse({ response });

          await handleRobotTaskResponse({
            botToken,
            chatId,
            response,
            store,
            sendMessage,
          });
          await appendTelegramMessageHistoryBatch({
            chatId,
            messages: newMessages,
            store,
          });
        }

        if (result.updates.length > 0) {
          state = {
            nextUpdateOffset: offset,
            lastReceivedAtMs: receivedMessage
              ? Date.now()
              : state.lastReceivedAtMs,
          };
          await writeTelegramState({ state, store });
        }

        if (once || shouldStop) {
          return;
        }

        await sleep({
          milliseconds: pollIntervalForState({
            state,
            coldPollIntervalMs,
            activePollIntervalMs,
            activePollWindowMs,
            nowMs: Date.now(),
          }),
          signal: abortController.signal,
        });
      } catch (error) {
        if (shouldStop && isAbortError({ error })) {
          return;
        }

        throw error;
      }
    } while (!once && !shouldStop);
  }
}

export async function runTelegramMonitor(
  options: TelegramMonitorOptions,
): Promise<void> {
  const handle = startTelegramPolling(options);

  const stop = (): void => {
    void handle.stop();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await handle.done;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}

export function telegramMonitorOptionsFromEnv(): TelegramMonitorOptions {
  const botToken = env.telegramBotToken;

  if (botToken === undefined) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set in the environment.");
  }

  return {
    botToken,
    adminChatIds: requireTelegramAdminChatIds(),
    timeoutSeconds: telegramConfig.longPollTimeoutSeconds,
    limit: telegramConfig.pollLimit,
    coldPollIntervalMs: telegramConfig.coldPollIntervalMs,
    activePollIntervalMs: telegramConfig.activePollIntervalMs,
    activePollWindowMs: telegramConfig.activePollWindowMs,
    once: false,
  };
}

function requireTelegramAdminChatIds(): readonly string[] {
  const chatIds = env.telegramAdminChatIds;

  if (chatIds.length === 0) {
    throw new Error("TELEGRAM_ADMIN_CHAT_IDS is not set in the environment.");
  }

  return chatIds;
}

function formatKeyValue({
  key,
  value,
}: {
  readonly key: string;
  readonly value: string;
}): string {
  return `${pc.dim(`${key}=`)}${value}`;
}

function logTelegramOpenAIResponse({
  response,
}: {
  readonly response: TelegramOpenAIResponse;
}): void {
  if (response.actions.length === 0) {
    return;
  }

  process.stdout.write(
    `${pc.bold("telegram")} ${formatKeyValue({
      key: "actions",
      value: JSON.stringify(response.actions),
    })}\n`,
  );
}

function isAbortError({ error }: { readonly error: unknown }): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function pollIntervalForState({
  state,
  coldPollIntervalMs,
  activePollIntervalMs,
  activePollWindowMs,
  nowMs,
}: {
  readonly state: Pick<TelegramState, "lastReceivedAtMs">;
  readonly coldPollIntervalMs: number;
  readonly activePollIntervalMs: number;
  readonly activePollWindowMs: number;
  readonly nowMs: number;
}): number {
  const lastReceivedAtMs = state.lastReceivedAtMs;

  if (lastReceivedAtMs === undefined) {
    return coldPollIntervalMs;
  }

  return nowMs - lastReceivedAtMs <= activePollWindowMs
    ? activePollIntervalMs
    : coldPollIntervalMs;
}

async function sleep({
  milliseconds,
  signal,
}: {
  readonly milliseconds: number;
  readonly signal: AbortSignal;
}): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new DOMException("Aborted", "AbortError"));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
