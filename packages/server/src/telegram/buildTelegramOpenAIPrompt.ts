import type { TelegramHistoryMessage } from "@herbert/server/telegram/telegramMessageHistory";
import type { RobotTaskAction } from "@herbert/shared";

export interface TelegramPromptObservation {
  readonly completedAtMs: number;
  readonly photoPath: string;
  readonly actions: readonly RobotTaskAction[];
}

export interface BuildTelegramOpenAIPromptOptions {
  readonly recentMessages: readonly TelegramHistoryMessage[];
  readonly newMessages: readonly TelegramHistoryMessage[];
  readonly taskState?: string;
  readonly observations?: readonly TelegramPromptObservation[];
}

export function buildTelegramOpenAIPrompt({
  recentMessages,
  newMessages,
  taskState,
  observations = [],
}: BuildTelegramOpenAIPromptOptions): string {
  return [
    "Authorized Telegram user messages from this admin chat, oldest first.",
    "Messages with <is_new>1</is_new> are newly received and have not been handled yet. Respond to the new messages as one combined admin request.",
    formatTelegramMessagesXml({ recentMessages, newMessages }),
    "Current task state:",
    taskState?.trim() ?? "none",
    "Robot observations from this task, oldest first:",
    formatObservationsXml({ observations }),
  ].join("\n\n");
}

function formatTelegramMessagesXml({
  recentMessages,
  newMessages,
}: {
  readonly recentMessages: readonly TelegramHistoryMessage[];
  readonly newMessages: readonly TelegramHistoryMessage[];
}): string {
  const messages = [
    ...recentMessages.map((message) => ({ message, isNew: false })),
    ...newMessages.map((message) => ({ message, isNew: true })),
  ];

  return [
    "<user_messages>",
    ...messages.map(({ message, isNew }) =>
      formatTelegramHistoryMessageXml({ message, isNew }),
    ),
    "</user_messages>",
  ].join("\n");
}

function formatTelegramHistoryMessageXml({
  message,
  isNew,
}: {
  readonly message: TelegramHistoryMessage;
  readonly isNew: boolean;
}): string {
  return [
    "  <message>",
    `    <sender>${escapeXmlText(message.sender)}</sender>`,
    `    <text>${escapeXmlText(message.text)}</text>`,
    `    <timestamp>${formatTelegramTimestamp({ dateSeconds: message.date })}</timestamp>`,
    `    <is_new>${isNew ? "1" : "0"}</is_new>`,
    "  </message>",
  ].join("\n");
}

function formatObservationsXml({
  observations,
}: {
  readonly observations: readonly TelegramPromptObservation[];
}): string {
  return [
    "<robot_observations>",
    ...observations.map((observation) => formatObservationXml({ observation })),
    "</robot_observations>",
  ].join("\n");
}

function formatObservationXml({
  observation,
}: {
  readonly observation: TelegramPromptObservation;
}): string {
  return [
    "  <observation>",
    `    <timestamp>${formatMillisecondsTimestamp({ milliseconds: observation.completedAtMs })}</timestamp>`,
    `    <completed_actions>${escapeXmlText(JSON.stringify(observation.actions))}</completed_actions>`,
    `    <photo_path>${escapeXmlText(observation.photoPath)}</photo_path>`,
    "  </observation>",
  ].join("\n");
}

function formatTelegramTimestamp({
  dateSeconds,
}: {
  readonly dateSeconds: number;
}): string {
  const date = new Date(dateSeconds * 1_000);
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  const hours = padDatePart(date.getUTCHours());
  const minutes = padDatePart(date.getUTCMinutes());
  const seconds = padDatePart(date.getUTCSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatMillisecondsTimestamp({
  milliseconds,
}: {
  readonly milliseconds: number;
}): string {
  return formatTelegramTimestamp({
    dateSeconds: Math.floor(milliseconds / 1_000),
  });
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function escapeXmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
