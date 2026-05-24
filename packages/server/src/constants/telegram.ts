export const telegramConfig = {
  longPollTimeoutSeconds: 1,
  pollLimit: 100,
  testMessageText: "herbert server telegram test",
} satisfies {
  readonly longPollTimeoutSeconds: number;
  readonly pollLimit: number;
  readonly testMessageText: string;
};
