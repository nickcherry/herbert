export const openaiConfig = {
  defaultModel: "gpt-5.5",
  defaultSchemaName: "response",
  defaultSpeechModel: "gpt-5.5-mini-tts",
  defaultSpeechVoice: "fable",
  defaultSpeechFormat: "mp3",
  includedCommentaryPhotoLimit: 5,
} satisfies {
  readonly defaultModel: string;
  readonly defaultSchemaName: string;
  readonly defaultSpeechModel: string;
  readonly defaultSpeechVoice: string;
  readonly defaultSpeechFormat: "mp3" | "wav" | "opus" | "aac" | "flac";
  readonly includedCommentaryPhotoLimit: number;
};
