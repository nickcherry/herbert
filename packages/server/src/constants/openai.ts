export const openaiConfig = {
  defaultModel: "gpt-5.5",
  defaultSchemaName: "response",
  defaultSpeechModel: "gpt-4o-mini-tts",
  defaultSpeechVoice: "cedar",
  defaultSpeechInstructions:
    "Voice direction for Herbert's spokenMessage: sound like a tiny British chauffeur: an adult British man who is polite, warm, deferential, mildly flustered when confused, and eager to be useful. Keep the delivery lightly funny without turning every line into a bit. Avoid smugness, arrogance, meanness, overconfidence, theatrical Victorian nonsense, and generic assistant voice.",
  defaultSpeechFormat: "mp3",
  defaultSpeechSpeed: 1.0,
  defaultSpeechRequestTimeoutMs: 30_000,
  includedCommentaryPhotoLimit: 5,
} satisfies {
  readonly defaultModel: string;
  readonly defaultSchemaName: string;
  readonly defaultSpeechModel: string;
  readonly defaultSpeechVoice: string;
  readonly defaultSpeechInstructions: string;
  readonly defaultSpeechFormat: "mp3" | "wav" | "opus" | "aac" | "flac";
  readonly defaultSpeechSpeed: number;
  readonly defaultSpeechRequestTimeoutMs: number;
  readonly includedCommentaryPhotoLimit: number;
};
