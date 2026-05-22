import type { TelegramHistoryMessage } from "@herbert/server/telegram/telegramMessageHistory";
import type { RobotTaskAction } from "@herbert/shared";

export type TelegramPromptTurnTrigger =
  | "telegram_messages"
  | "robot_commentary";

export interface TelegramPromptCommentary {
  readonly completedAtMs: number;
  readonly photoPath: string;
  readonly actions: readonly RobotTaskAction[];
}

export interface BuildTelegramOpenAIPromptOptions {
  readonly recentMessages: readonly TelegramHistoryMessage[];
  readonly newMessages: readonly TelegramHistoryMessage[];
  readonly turnTrigger: TelegramPromptTurnTrigger;
  readonly taskState?: string;
  readonly commentary?: readonly TelegramPromptCommentary[];
  readonly hasAttachedImages?: boolean;
}

export function buildTelegramOpenAIPrompt({
  recentMessages,
  newMessages,
  turnTrigger,
  taskState,
  commentary = [],
  hasAttachedImages = false,
}: BuildTelegramOpenAIPromptOptions): string {
  return [
    "Current turn context:",
    formatTurnContextXml({
      turnTrigger,
      newMessageCount: newMessages.length,
      commentaryCount: commentary.length,
      hasAttachedImages,
    }),
    "Authorized Telegram user messages from this admin chat, oldest first.",
    "Messages with <is_new>1</is_new> are newly received and have not been handled yet. Respond to them together as one combined admin request.",
    "Messages with <is_new>0</is_new> are prior context that has already been handled; do not re-respond to them.",
    "If there are no new messages and the trigger is robot_commentary, continue the active task from the current task state and the latest robot commentary entry.",
    "All timestamps are UTC.",
    formatTelegramMessagesXml({ recentMessages, newMessages }),
    'Current task state (Herbert\'s durable memory carried over from the previous turn; "none" if no task is active):',
    taskState?.trim() ?? "none",
    "Robot commentary from this task so far, oldest first. Each entry reports the actions Herbert just completed at the end of a batch and the path to the photo Herbert captured immediately after. On robot_commentary turns the latest commentary photo is attached to this prompt as an image input; earlier entries are text-only.",
    formatRobotCommentariesXml({ commentary }),
  ].join("\n\n");
}

function formatTurnContextXml({
  turnTrigger,
  newMessageCount,
  commentaryCount,
  hasAttachedImages,
}: {
  readonly turnTrigger: TelegramPromptTurnTrigger;
  readonly newMessageCount: number;
  readonly commentaryCount: number;
  readonly hasAttachedImages: boolean;
}): string {
  return [
    "<turn_context>",
    `  <trigger>${turnTrigger}</trigger>`,
    `  <new_message_count>${newMessageCount}</new_message_count>`,
    `  <robot_commentary_count>${commentaryCount}</robot_commentary_count>`,
    `  <latest_image_attached>${hasAttachedImages ? "1" : "0"}</latest_image_attached>`,
    "</turn_context>",
  ].join("\n");
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

function formatRobotCommentariesXml({
  commentary,
}: {
  readonly commentary: readonly TelegramPromptCommentary[];
}): string {
  return [
    "<robot_commentaries>",
    ...commentary.map((entry) => formatCommentaryXml({ entry })),
    "</robot_commentaries>",
  ].join("\n");
}

function formatCommentaryXml({
  entry,
}: {
  readonly entry: TelegramPromptCommentary;
}): string {
  return [
    "  <commentary>",
    `    <timestamp>${formatMillisecondsTimestamp({ milliseconds: entry.completedAtMs })}</timestamp>`,
    `    <completed_actions>${escapeXmlText(JSON.stringify(entry.actions))}</completed_actions>`,
    `    <photo_path>${escapeXmlText(entry.photoPath)}</photo_path>`,
    "  </commentary>",
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
