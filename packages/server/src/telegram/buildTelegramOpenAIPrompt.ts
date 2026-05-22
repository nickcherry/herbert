import type {
  HerbertHistoryResponse,
  RobotTaskAction,
  RobotTaskCameraPosition,
  TelegramHistoryMessage,
} from "@herbert/shared";

export type TelegramPromptTurnTrigger =
  | "telegram_messages"
  | "batch_complete";

export interface TelegramPromptBatchReport {
  readonly completedAtMs: number;
  readonly photoPath: string;
  readonly cameraPosition?: RobotTaskCameraPosition;
  readonly actions: readonly RobotTaskAction[];
}

export interface BuildTelegramOpenAIPromptOptions {
  readonly recentMessages: readonly TelegramHistoryMessage[];
  readonly newMessages: readonly TelegramHistoryMessage[];
  readonly recentHerbertResponses?: readonly HerbertHistoryResponse[];
  readonly turnTrigger: TelegramPromptTurnTrigger;
  readonly taskState?: string;
  readonly batchReports?: readonly TelegramPromptBatchReport[];
  readonly hasAttachedImages?: boolean;
  readonly attachedImageCount?: number;
  readonly nowMs?: number;
}

export function buildTelegramOpenAIPrompt({
  recentMessages,
  newMessages,
  recentHerbertResponses = [],
  turnTrigger,
  taskState,
  batchReports = [],
  hasAttachedImages = false,
  attachedImageCount,
  nowMs: _nowMs = Date.now(),
}: BuildTelegramOpenAIPromptOptions): string {
  const resolvedAttachedCount = attachedImageCount ?? (hasAttachedImages ? 1 : 0);
  return [
    "Current turn context:",
    formatTurnContextXml({
      turnTrigger,
      newMessageCount: newMessages.length,
      batchReportCount: batchReports.length,
      attachedImageCount: resolvedAttachedCount,
    }),
    "Recent conversation history for this admin chat, oldest first.",
    "User messages with <is_new>1</is_new> are newly received and have not been handled yet. Respond to them together as one combined admin request.",
    "User messages with <is_new>0</is_new> are prior context that has already been handled; do not re-respond to them.",
    "Herbert responses are prior text Herbert already sent to Telegram and/or spoke out loud; use them for continuity, and do not repeat them unless useful.",
    "Older user messages and Herbert responses outside the recent context window are dropped before this prompt is built, so only the freshest authorized history is shown.",
    "If there are no new messages and the trigger is batch_complete, continue the active task from the current task state and the latest batch report entry.",
    "All timestamps are UTC.",
    formatTelegramMessagesXml({ recentMessages, newMessages }),
    formatHerbertResponsesXml({ responses: recentHerbertResponses }),
    'Current task state (Herbert\'s durable memory carried over from the previous turn; "none" if no task is active):',
    taskState?.trim() ?? "none",
    "Batch reports from this task so far, oldest first. Each batch report signals that a batch finished and lists the actions Herbert just completed, the camera pan/tilt after the batch when available, and the path to the photo Herbert captured immediately after. The most recent batch report photos are attached to this prompt as image inputs (the LAST attached image is the latest; earlier attached images come from earlier batch reports and are downsampled). Batch reports with no matching attached image are text-only on this turn.",
    formatBatchReportsXml({ batchReports }),
  ].join("\n\n");
}

function formatTurnContextXml({
  turnTrigger,
  newMessageCount,
  batchReportCount,
  attachedImageCount,
}: {
  readonly turnTrigger: TelegramPromptTurnTrigger;
  readonly newMessageCount: number;
  readonly batchReportCount: number;
  readonly attachedImageCount: number;
}): string {
  return [
    "<turn_context>",
    `  <trigger>${turnTrigger}</trigger>`,
    `  <new_message_count>${newMessageCount}</new_message_count>`,
    `  <batch_report_count>${batchReportCount}</batch_report_count>`,
    `  <attached_image_count>${attachedImageCount}</attached_image_count>`,
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

function formatHerbertResponsesXml({
  responses,
}: {
  readonly responses: readonly HerbertHistoryResponse[];
}): string {
  return [
    "<herbert_responses>",
    ...responses.map((response) => formatHerbertResponseXml({ response })),
    "</herbert_responses>",
  ].join("\n");
}

function formatHerbertResponseXml({
  response,
}: {
  readonly response: HerbertHistoryResponse;
}): string {
  const lines = [
    "  <response>",
    `    <timestamp>${formatMillisecondsTimestamp({ milliseconds: response.createdAtMs })}</timestamp>`,
  ];

  if (response.telegramMessage !== null) {
    lines.push(
      `    <telegram_message>${escapeXmlText(response.telegramMessage)}</telegram_message>`,
    );
  }

  if (response.spokenMessage !== null) {
    lines.push(
      `    <spoken_message>${escapeXmlText(response.spokenMessage)}</spoken_message>`,
    );
  }

  lines.push("  </response>");
  return lines.join("\n");
}

function formatBatchReportsXml({
  batchReports,
}: {
  readonly batchReports: readonly TelegramPromptBatchReport[];
}): string {
  return [
    "<batch_reports>",
    ...batchReports.map((entry) => formatBatchReportXml({ entry })),
    "</batch_reports>",
  ].join("\n");
}

function formatBatchReportXml({
  entry,
}: {
  readonly entry: TelegramPromptBatchReport;
}): string {
  const lines = [
    "  <batch_report>",
    `    <timestamp>${formatMillisecondsTimestamp({ milliseconds: entry.completedAtMs })}</timestamp>`,
    `    <completed_actions>${escapeXmlText(JSON.stringify(entry.actions))}</completed_actions>`,
  ];

  if (entry.cameraPosition !== undefined) {
    lines.push(
      "    <camera_position>",
      `      <pan>${entry.cameraPosition.pan}</pan>`,
      `      <tilt>${entry.cameraPosition.tilt}</tilt>`,
      "    </camera_position>",
    );
  }

  lines.push(
    `    <photo_path>${escapeXmlText(entry.photoPath)}</photo_path>`,
    "  </batch_report>",
  );

  return lines.join("\n");
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
