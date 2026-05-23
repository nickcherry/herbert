export interface OpenaiCallLogEntry {
  readonly id: string;
  readonly createdAtMs: number;
  readonly type: string;
  readonly model: string;
  readonly schemaName: string;
  readonly chatId: string | null;
  readonly taskId: string | null;
  readonly instructions: string | null;
  readonly prompt: string;
  readonly imagePaths: readonly string[];
  readonly responseJson: string | null;
  readonly errorMessage: string | null;
  readonly latencyMs: number;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export type AppendOpenaiCallLogEntry = Omit<OpenaiCallLogEntry, "id">;

export interface ListOpenaiCallLogFilters {
  readonly type?: string;
  readonly chatId?: string;
  readonly taskId?: string;
  readonly sinceMs?: number;
  readonly limit?: number;
}

export interface OpenaiCallLog {
  readonly append: (
    entry: AppendOpenaiCallLogEntry,
  ) => Promise<OpenaiCallLogEntry>;
  readonly list: (
    filters?: ListOpenaiCallLogFilters,
  ) => Promise<readonly OpenaiCallLogEntry[]>;
}
