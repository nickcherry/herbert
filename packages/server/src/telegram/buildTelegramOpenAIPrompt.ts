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
  readonly distanceCm?: number;
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
    formatFloorplanXml(),
    formatTurnContextXml({
      turnTrigger,
      newMessageCount: newMessages.length,
      batchReportCount: batchReports.length,
      attachedImageCount: resolvedAttachedCount,
    }),
    formatTelegramMessagesXml({ recentMessages, newMessages }),
    formatHerbertResponsesXml({ responses: recentHerbertResponses }),
    formatTaskStateXml({ taskState }),
    formatBatchReportsXml({ batchReports }),
  ].join("\n\n");
}

function formatTaskStateXml({
  taskState,
}: {
  readonly taskState: string | undefined;
}): string {
  const value = taskState?.trim();
  return value === undefined || value.length === 0
    ? "<task_state>none</task_state>"
    : `<task_state>\n${value}\n</task_state>`;
}

function formatFloorplanXml(): string {
  return [
    "<floorplan>",
    "  <address>22 North 6th Street, Unit 10C</address>",
    "  <rooms>",
    '    <room number="1" name="Living / Dining Room" dimensions="27\'9&quot; x 12\'9&quot;" />',
    '    <room number="2" name="Kitchen + Living Room" />',
    '    <room number="3" name="Master Bath" />',
    '    <room number="4" name="Hall to Master Bedroom" />',
    '    <room number="5" name="Master Bedroom" dimensions="14\'8&quot; x 13\'10&quot;" />',
    '    <room number="6" name="Entry / Kitchen / Office" />',
    '    <room number="7" name="Second Bedroom / Office" dimensions="10\'3&quot; x 12\'7&quot;" />',
    "  </rooms>",
    "  <other_features>Balcony (7' x 13') off Living/Dining; second Bath off the hallway near room 7; W/D closet; several CL closets along interior walls.</other_features>",
    "  <usage>When a batch photo resembles a numbered reference photo, Herbert is roughly at that marker. Use the layout for room boundaries, doorways, and distances. NOT Herbert's current view.</usage>",
    "</floorplan>",
  ].join("\n");
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

  if (entry.distanceCm !== undefined) {
    lines.push(`    <ultrasonic_distance_cm>${entry.distanceCm}</ultrasonic_distance_cm>`);
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
