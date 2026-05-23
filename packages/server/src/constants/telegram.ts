export const telegramConfig = {
  longPollTimeoutSeconds: 1,
  pollLimit: 100,
  coldPollIntervalMs: 10_000,
  activePollIntervalMs: 2_000,
  activePollWindowMs: 30_000,
  openAIContextMessageLimit: 20,
  openAIContextMessageMaxAgeMs: 30 * 60 * 1_000,
  openAIBatchPhotoLimit: 1,
  testMessageText: "herbert server telegram test",
  pingResponseText: "herbert server: pong",
} satisfies {
  readonly longPollTimeoutSeconds: number;
  readonly pollLimit: number;
  readonly coldPollIntervalMs: number;
  readonly activePollIntervalMs: number;
  readonly activePollWindowMs: number;
  readonly openAIContextMessageLimit: number;
  readonly openAIContextMessageMaxAgeMs: number;
  readonly openAIBatchPhotoLimit: number;
  readonly testMessageText: string;
  readonly pingResponseText: string;
};
