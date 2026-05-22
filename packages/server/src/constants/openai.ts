export const openaiConfig = {
  defaultModel: "gpt-5.5",
  defaultSchemaName: "response",
  includedBatchPhotoLimit: 5,
} satisfies {
  readonly defaultModel: string;
  readonly defaultSchemaName: string;
  readonly includedBatchPhotoLimit: number;
};
