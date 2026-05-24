import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { defaultDocumentStore } from "@herbert/server/persistence/defaultDocumentStore";
import type { DocumentStore } from "@herbert/server/persistence/documentStore";
import { defaultOpenaiCallLog } from "@herbert/server/persistence/openaiCallLog";
import type { OpenaiCallLogEntry } from "@herbert/server/persistence/openaiCallLog/openaiCallLog";
import { readQueueDocument } from "@herbert/server/persistence/operations/robotTaskQueue/queueDocument";
import type {
  RobotTaskBatchReport,
  RobotTaskSession,
} from "@herbert/shared/robotTaskQueue";

const TELEGRAM_ROBOT_TURN_LOG_TYPE = "telegram_robot_turn";
const SESSION_BOUNDARY_GRACE_MS = 5 * 60 * 1_000;

export interface GenerateTelegramSessionSummaryHtmlOptions {
  readonly outputPath?: string;
  readonly sessionId?: string;
  readonly store?: DocumentStore;
  readonly openaiLog?: {
    readonly list: (filters?: {
      readonly chatId?: string;
      readonly taskId?: string;
      readonly limit?: number;
    }) => Promise<readonly OpenaiCallLogEntry[]>;
  };
  readonly nowMs?: number;
}

export interface GenerateTelegramSessionSummaryHtmlResult {
  readonly outputPath: string;
  readonly sessionId: string;
  readonly turnCount: number;
  readonly batchReportCount: number;
}

export async function generateTelegramSessionSummaryHtml({
  outputPath,
  sessionId,
  store = defaultDocumentStore(),
  openaiLog = defaultOpenaiCallLog(),
  nowMs = Date.now(),
}: GenerateTelegramSessionSummaryHtmlOptions = {}): Promise<GenerateTelegramSessionSummaryHtmlResult> {
  const queue = await readQueueDocument({ store });
  const session = selectSession({
    sessions: queue.sessions,
    sessionId,
  });
  const entries = await readPotentialOpenaiTurnEntries({
    log: openaiLog,
    session,
  });
  const turns = selectSessionOpenaiTurns({
    entries,
    session,
    sessions: queue.sessions,
  });
  const resolvedOutputPath = resolve(
    outputPath ?? defaultSummaryOutputPath({ session }),
  );
  const html = renderTelegramSessionSummaryHtml({
    generatedAtMs: nowMs,
    session,
    turns,
  });

  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, html, "utf8");

  return {
    outputPath: resolvedOutputPath,
    sessionId: session.id,
    turnCount: turns.length,
    batchReportCount: session.batchReports.length,
  };
}

export function selectSessionOpenaiTurns({
  entries,
  session,
  sessions,
}: {
  readonly entries: readonly OpenaiCallLogEntry[];
  readonly session: RobotTaskSession;
  readonly sessions: readonly RobotTaskSession[];
}): readonly OpenaiCallLogEntry[] {
  const bounds = sessionTimeBounds({ session, sessions });
  const unique = new Map<string, OpenaiCallLogEntry>();

  for (const entry of entries) {
    if (entry.type !== TELEGRAM_ROBOT_TURN_LOG_TYPE) {
      continue;
    }

    const belongsByTask = entry.taskId === session.id;
    const belongsByInitialChatTurn =
      entry.taskId === null &&
      entry.chatId === session.chatId &&
      entry.createdAtMs > bounds.afterMs &&
      entry.createdAtMs <= session.createdAtMs;

    if (belongsByTask || belongsByInitialChatTurn) {
      unique.set(entry.id, entry);
    }
  }

  return [...unique.values()].sort(
    (left, right) =>
      left.createdAtMs - right.createdAtMs || left.id.localeCompare(right.id),
  );
}

export function renderTelegramSessionSummaryHtml({
  generatedAtMs,
  session,
  turns,
}: {
  readonly generatedAtMs: number;
  readonly session: RobotTaskSession;
  readonly turns: readonly OpenaiCallLogEntry[];
}): string {
  const events = [
    ...turns.map((turn, index) => ({
      atMs: turn.createdAtMs,
      html: renderOpenaiTurn({ turn, index }),
      sort: 0,
    })),
    ...session.batchReports.map((report, index) => ({
      atMs: report.completedAtMs,
      html: renderBatchReport({ report, index }),
      sort: 1,
    })),
  ].sort((left, right) => left.atMs - right.atMs || left.sort - right.sort);

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(`Herbert session ${session.id}`)}</title>`,
    `  <style>${css()}</style>`,
    "</head>",
    "<body>",
    '  <main class="page">',
    "    <header>",
    '      <p class="eyebrow">Herbert Telegram Session</p>',
    `      <h1>${escapeHtml(session.id)}</h1>`,
    '      <dl class="meta-grid">',
    renderMeta("status", session.status),
    renderMeta("chat", session.chatId),
    renderMeta("created", formatTimestamp(session.createdAtMs)),
    renderMeta("updated", formatTimestamp(session.updatedAtMs)),
    renderMeta("generated", formatTimestamp(generatedAtMs)),
    renderMeta("openai turns", String(turns.length)),
    renderMeta("batch reports", String(session.batchReports.length)),
    "      </dl>",
    "    </header>",
    '    <section class="panel">',
    "      <h2>Current Task State</h2>",
    `      <p class="task-state">${escapeHtml(session.taskState)}</p>`,
    "    </section>",
    '    <section class="timeline">',
    "      <h2>Timeline</h2>",
    events.length === 0
      ? '      <p class="empty">No OpenAI turns or batch reports were found for this session.</p>'
      : events.map((event) => event.html).join("\n"),
    "    </section>",
    "  </main>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function selectSession({
  sessions,
  sessionId,
}: {
  readonly sessions: readonly RobotTaskSession[];
  readonly sessionId: string | undefined;
}): RobotTaskSession {
  if (sessionId !== undefined) {
    const session = sessions.find((candidate) => candidate.id === sessionId);

    if (session === undefined) {
      throw new Error(`Unknown robot task session: ${sessionId}`);
    }

    return session;
  }

  const session = [...sessions].sort(
    (left, right) =>
      right.updatedAtMs - left.updatedAtMs ||
      right.createdAtMs - left.createdAtMs ||
      right.id.localeCompare(left.id),
  )[0];

  if (session === undefined) {
    throw new Error("No robot task sessions found.");
  }

  return session;
}

async function readPotentialOpenaiTurnEntries({
  log,
  session,
}: {
  readonly log: NonNullable<
    GenerateTelegramSessionSummaryHtmlOptions["openaiLog"]
  >;
  readonly session: RobotTaskSession;
}): Promise<readonly OpenaiCallLogEntry[]> {
  const [taskEntries, chatEntries] = await Promise.all([
    log.list({ taskId: session.id, limit: 500 }),
    log.list({ chatId: session.chatId, limit: 500 }),
  ]);
  const unique = new Map<string, OpenaiCallLogEntry>();

  for (const entry of [...taskEntries, ...chatEntries]) {
    unique.set(entry.id, entry);
  }

  return [...unique.values()];
}

function sessionTimeBounds({
  session,
  sessions,
}: {
  readonly session: RobotTaskSession;
  readonly sessions: readonly RobotTaskSession[];
}): {
  readonly afterMs: number;
} {
  const chatSessions = sessions
    .filter((candidate) => candidate.chatId === session.chatId)
    .sort(
      (left, right) =>
        left.createdAtMs - right.createdAtMs ||
        left.updatedAtMs - right.updatedAtMs ||
        left.id.localeCompare(right.id),
    );
  const index = chatSessions.findIndex(
    (candidate) => candidate.id === session.id,
  );
  const previous = index <= 0 ? undefined : chatSessions[index - 1];

  return {
    afterMs:
      previous?.updatedAtMs ?? session.createdAtMs - SESSION_BOUNDARY_GRACE_MS,
  };
}

function renderOpenaiTurn({
  turn,
  index,
}: {
  readonly turn: OpenaiCallLogEntry;
  readonly index: number;
}): string {
  const prompt = summarizePrompt({ prompt: turn.prompt });
  const response = parseResponseJson({ responseJson: turn.responseJson });

  return [
    '      <article class="event turn">',
    '        <div class="event-heading">',
    `          <div><p class="event-type">OpenAI Turn ${index + 1}</p><h3>${escapeHtml(prompt.trigger ?? "unknown trigger")}</h3></div>`,
    `          <time>${escapeHtml(formatTimestamp(turn.createdAtMs))}</time>`,
    "        </div>",
    '        <dl class="meta-grid compact">',
    renderMeta("model", turn.model),
    renderMeta("schema", turn.schemaName),
    renderMeta("task", turn.taskId ?? "null"),
    renderMeta("latency", `${turn.latencyMs} ms`),
    renderMeta("input tokens", formatNullableNumber(turn.inputTokens)),
    renderMeta("output tokens", formatNullableNumber(turn.outputTokens)),
    "        </dl>",
    turn.errorMessage === null
      ? ""
      : `        <p class="error">${escapeHtml(turn.errorMessage)}</p>`,
    renderPromptMessages({ prompt }),
    renderOpenaiResponse({ response }),
    renderImages({ imagePaths: turn.imagePaths }),
    renderDetails({ label: "Full Prompt", value: turn.prompt }),
    turn.instructions === null
      ? ""
      : renderDetails({
          label: "System Instructions",
          value: turn.instructions,
        }),
    "      </article>",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderBatchReport({
  report,
  index,
}: {
  readonly report: RobotTaskBatchReport;
  readonly index: number;
}): string {
  return [
    '      <article class="event batch">',
    '        <div class="event-heading">',
    `          <div><p class="event-type">Robot Batch ${index + 1}</p><h3>${escapeHtml(report.batchId)}</h3></div>`,
    `          <time>${escapeHtml(formatTimestamp(report.completedAtMs))}</time>`,
    "        </div>",
    '        <dl class="meta-grid compact">',
    renderMeta("camera", formatCameraPosition({ report })),
    renderMeta("steering", formatSteeringAngle({ report })),
    renderMeta("ultrasonic", formatDistance({ report })),
    renderMeta("photo", report.photoPath),
    "        </dl>",
    renderImageFigure({
      label: "completion photo",
      path: report.photoPath,
    }),
    "        <h4>Completed Actions</h4>",
    `        <pre>${escapeHtml(JSON.stringify(report.actions, null, 2))}</pre>`,
    renderPhotoObservation({ report }),
    "      </article>",
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderPromptMessages({
  prompt,
}: {
  readonly prompt: PromptSummary;
}): string {
  const messages = prompt.messages;

  if (messages.length === 0) {
    return '        <p class="empty">No user messages in prompt.</p>';
  }

  return [
    "        <h4>User Messages In Prompt</h4>",
    '        <ol class="messages">',
    ...messages.map(
      (message) =>
        `          <li${message.isNew ? ' class="new-message"' : ""}><span>${escapeHtml(message.timestamp ?? "unknown time")}</span><strong>${escapeHtml(message.sender ?? "unknown")}</strong><p>${escapeHtml(message.text ?? "")}</p></li>`,
    ),
    "        </ol>",
  ].join("\n");
}

function renderOpenaiResponse({
  response,
}: {
  readonly response: ParsedResponse | undefined;
}): string {
  if (response === undefined) {
    return '        <p class="empty">No parsed JSON response.</p>';
  }

  return [
    "        <h4>Response</h4>",
    '        <dl class="response-grid">',
    renderMeta("finished", String(response.isFinished ?? "unknown")),
    renderMeta("telegram", response.telegramMessage ?? "null"),
    renderMeta("spoken", response.spokenMessage ?? "null"),
    "        </dl>",
    response.taskState === undefined
      ? ""
      : `        <p class="task-state">${escapeHtml(response.taskState)}</p>`,
    "        <h4>Actions</h4>",
    `        <pre>${escapeHtml(JSON.stringify(response.actions ?? [], null, 2))}</pre>`,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderImages({
  imagePaths,
}: {
  readonly imagePaths: readonly string[];
}): string {
  if (imagePaths.length === 0) {
    return '        <p class="empty">No image paths logged.</p>';
  }

  return [
    "        <h4>Images Sent To OpenAI</h4>",
    '        <div class="image-grid">',
    ...imagePaths.map((path, index) =>
      renderImageFigure({
        label: imageLabel({ index, count: imagePaths.length, path }),
        path,
      }),
    ),
    "        </div>",
  ].join("\n");
}

function renderImageFigure({
  label,
  path,
}: {
  readonly label: string;
  readonly path: string;
}): string {
  const resolvedPath = resolve(path);
  const url = pathToFileURL(resolvedPath).href;
  const exists = existsSync(resolvedPath);

  return [
    `        <figure class="image-card${exists ? "" : " missing"}">`,
    exists
      ? `          <a href="${escapeHtml(url)}"><img src="${escapeHtml(url)}" loading="lazy" alt="${escapeHtml(label)}"></a>`
      : '          <div class="missing-image">missing image file</div>',
    `          <figcaption><strong>${escapeHtml(label)}</strong><span>${escapeHtml(path)}</span></figcaption>`,
    "        </figure>",
  ].join("\n");
}

function renderPhotoObservation({
  report,
}: {
  readonly report: RobotTaskBatchReport;
}): string {
  const observation = report.photoObservation;

  if (observation === undefined) {
    return "";
  }

  return [
    "        <h4>Stored Photo Observation</h4>",
    '        <dl class="response-grid">',
    renderMeta("summary", observation.summary),
    renderMeta("target progress", observation.targetProgress ?? "null"),
    renderMeta("navigable space", observation.navigableSpace),
    renderMeta("view quality", observation.viewQuality),
    renderMeta(
      "recommended next move",
      observation.recommendedNextMove ?? "null",
    ),
    renderMeta(
      "notable objects",
      observation.notableObjects.join(", ") || "none",
    ),
    renderMeta(
      "distance estimates",
      formatPhotoObservationDistanceEstimates({ observation }),
    ),
    renderMeta(
      "floorplan position",
      formatPhotoObservationFloorplanPosition({ observation }),
    ),
    "        </dl>",
  ].join("\n");
}

function formatPhotoObservationDistanceEstimates({
  observation,
}: {
  readonly observation: NonNullable<RobotTaskBatchReport["photoObservation"]>;
}): string {
  if (observation.distanceEstimates.length === 0) {
    return "none";
  }

  return observation.distanceEstimates
    .map((estimate) => {
      const distance =
        estimate.distanceCm === null ? "unknown" : `${estimate.distanceCm} cm`;
      return `${estimate.subject} (${estimate.category}, ${distance}, ${estimate.confidence} confidence)`;
    })
    .join("; ");
}

function formatPhotoObservationFloorplanPosition({
  observation,
}: {
  readonly observation: NonNullable<RobotTaskBatchReport["photoObservation"]>;
}): string {
  const position = observation.floorplanPosition;

  if (position.xPct === null || position.yPct === null) {
    return `unknown (${position.confidence} confidence): ${position.rationale}`;
  }

  const room =
    position.roomId === null ? "room unknown" : `room ${position.roomId}`;
  return `x ${position.xPct}, y ${position.yPct} (${room}, ${position.confidence} confidence): ${position.rationale}`;
}

function renderDetails({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): string {
  return [
    "        <details>",
    `          <summary>${escapeHtml(label)}</summary>`,
    `          <pre>${escapeHtml(value)}</pre>`,
    "        </details>",
  ].join("\n");
}

function renderMeta(label: string, value: string): string {
  return [
    "          <div>",
    `            <dt>${escapeHtml(label)}</dt>`,
    `            <dd>${escapeHtml(value)}</dd>`,
    "          </div>",
  ].join("\n");
}

interface PromptSummary {
  readonly trigger?: string;
  readonly messages: readonly PromptMessage[];
}

interface PromptMessage {
  readonly sender?: string;
  readonly text?: string;
  readonly timestamp?: string;
  readonly isNew: boolean;
}

interface ParsedResponse {
  readonly telegramMessage?: string | null;
  readonly spokenMessage?: string | null;
  readonly taskState?: string;
  readonly isFinished?: boolean;
  readonly actions?: unknown;
}

function summarizePrompt({
  prompt,
}: {
  readonly prompt: string;
}): PromptSummary {
  return {
    trigger: tagText({ source: prompt, tagName: "trigger" }),
    messages: [...prompt.matchAll(/<message>\s*([\s\S]*?)\s*<\/message>/g)].map(
      (match) => {
        const block = match[1] ?? "";
        return {
          sender: tagText({ source: block, tagName: "sender" }),
          text: tagText({ source: block, tagName: "text" }),
          timestamp: tagText({ source: block, tagName: "timestamp" }),
          isNew: tagText({ source: block, tagName: "is_new" }) === "1",
        };
      },
    ),
  };
}

function tagText({
  source,
  tagName,
}: {
  readonly source: string;
  readonly tagName: string;
}): string | undefined {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`).exec(
    source,
  );
  const value = match?.[1]?.trim();
  return value === undefined || value.length === 0
    ? undefined
    : decodeXmlText(value);
}

function parseResponseJson({
  responseJson,
}: {
  readonly responseJson: string | null;
}): ParsedResponse | undefined {
  if (responseJson === null) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(responseJson);

    if (parsed === null || typeof parsed !== "object") {
      return undefined;
    }

    const record = parsed as Record<string, unknown>;
    return {
      telegramMessage: nullableString(record.telegramMessage),
      spokenMessage: nullableString(record.spokenMessage),
      taskState:
        typeof record.taskState === "string" ? record.taskState : undefined,
      isFinished:
        typeof record.isFinished === "boolean" ? record.isFinished : undefined,
      actions: record.actions,
    };
  } catch {
    return undefined;
  }
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "string" ? value : undefined;
}

function imageLabel({
  index,
  count,
  path,
}: {
  readonly index: number;
  readonly count: number;
  readonly path: string;
}): string {
  if (
    index === 0 ||
    path.includes("/floorplan-") ||
    path.includes("/floorplan.")
  ) {
    return "floorplan";
  }
  if (path.includes("/room-references/")) {
    return `room reference: ${basename(path, extname(path))}`;
  }
  if (index === count - 1) {
    return "latest robot photo";
  }
  return `image ${index + 1}`;
}

function defaultSummaryOutputPath({
  session,
}: {
  readonly session: RobotTaskSession;
}): string {
  return join(
    "tmp",
    "herbert-session-summary",
    `${safePathSegment(session.id)}.html`,
  );
}

function safePathSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, "_");
}

function formatCameraPosition({
  report,
}: {
  readonly report: RobotTaskBatchReport;
}): string {
  if (report.cameraPosition === undefined) {
    return "unknown";
  }
  return `pan ${report.cameraPosition.pan}, tilt ${report.cameraPosition.tilt}`;
}

function formatDistance({
  report,
}: {
  readonly report: RobotTaskBatchReport;
}): string {
  return report.distanceCm === undefined
    ? "unknown"
    : `${report.distanceCm} cm`;
}

function formatSteeringAngle({
  report,
}: {
  readonly report: RobotTaskBatchReport;
}): string {
  return report.steeringAngle === undefined
    ? "unknown"
    : `${report.steeringAngle} deg`;
}

function formatNullableNumber(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

function formatTimestamp(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function css(): string {
  return `
:root {
  color-scheme: light;
  --bg: #f6f5f2;
  --paper: #ffffff;
  --ink: #202124;
  --muted: #6f6f6f;
  --line: #d8d3ca;
  --accent: #0d6b5f;
  --accent-soft: #e3f2ef;
  --warn: #9a3412;
  --warn-soft: #fff2e8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page {
  width: min(1200px, calc(100vw - 32px));
  margin: 0 auto;
  padding: 32px 0 56px;
}

header,
.panel,
.event {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 20px;
}

header {
  margin-bottom: 16px;
}

.eyebrow,
.event-type {
  margin: 0 0 4px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2,
h3,
h4 {
  margin: 0;
  line-height: 1.2;
}

h1 {
  font-size: 28px;
}

h2 {
  margin-bottom: 12px;
  font-size: 18px;
}

h3 {
  font-size: 16px;
}

h4 {
  margin: 18px 0 8px;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--muted);
}

.panel {
  margin-bottom: 16px;
}

.timeline {
  display: grid;
  gap: 12px;
}

.event {
  display: grid;
  gap: 12px;
}

.event-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

time {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.meta-grid,
.response-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin: 16px 0 0;
}

.compact {
  margin-top: 0;
}

dt {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

dd {
  margin: 2px 0 0;
  overflow-wrap: anywhere;
}

.task-state {
  margin: 0;
  white-space: pre-wrap;
}

.messages {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.messages li {
  border-left: 3px solid var(--line);
  padding: 8px 10px;
  background: #fafafa;
}

.messages .new-message {
  border-left-color: var(--accent);
  background: var(--accent-soft);
}

.messages span {
  display: block;
  color: var(--muted);
  font-size: 12px;
}

.messages p {
  margin: 4px 0 0;
  white-space: pre-wrap;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.image-card {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}

.image-card img,
.missing-image {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: contain;
  background: #ece9e1;
}

.missing-image {
  display: grid;
  place-items: center;
  color: var(--warn);
  background: var(--warn-soft);
}

figcaption {
  display: grid;
  gap: 2px;
  padding: 8px 10px;
}

figcaption span {
  color: var(--muted);
  font-size: 12px;
  overflow-wrap: anywhere;
}

pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: #1f2933;
  color: #f7fafc;
  border-radius: 6px;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

details {
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 700;
}

details pre {
  margin-top: 10px;
}

.empty {
  margin: 0;
  color: var(--muted);
}

.error {
  margin: 0;
  padding: 10px;
  color: var(--warn);
  background: var(--warn-soft);
  border-radius: 6px;
}

@media (max-width: 700px) {
  .page {
    width: min(100vw - 20px, 1200px);
    padding-top: 16px;
  }

  .event-heading {
    display: grid;
  }

  time {
    white-space: normal;
  }
}
`;
}
