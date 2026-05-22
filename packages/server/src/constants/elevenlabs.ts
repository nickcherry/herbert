export const elevenLabsConfig = {
  apiBaseUrl: "https://api.elevenlabs.io",
  defaultSpeechModel: "eleven_multilingual_v2",
  defaultSpeechVoiceId: "jvcMcno3QtjOzGtfpjoI",
  defaultSpeechVoiceName: "Herbert default",
  defaultSpeechOutputFormat: "mp3_44100_128",
  defaultSpeechStability: 0.5,
  defaultSpeechSimilarityBoost: 0.75,
  defaultSpeechStyle: 0,
  defaultSpeechUseSpeakerBoost: true,
  defaultSpeechSpeed: 1.0,
  defaultSpeechRequestTimeoutMs: 30_000,
} satisfies {
  readonly apiBaseUrl: string;
  readonly defaultSpeechModel: string;
  readonly defaultSpeechVoiceId: string;
  readonly defaultSpeechVoiceName: string;
  readonly defaultSpeechOutputFormat: string;
  readonly defaultSpeechStability: number;
  readonly defaultSpeechSimilarityBoost: number;
  readonly defaultSpeechStyle: number;
  readonly defaultSpeechUseSpeakerBoost: boolean;
  readonly defaultSpeechSpeed: number;
  readonly defaultSpeechRequestTimeoutMs: number;
};
