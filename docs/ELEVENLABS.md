# ElevenLabs

The server package uses ElevenLabs for server-side text-to-speech under
`packages/server/src/elevenlabs`.

## Environment

```sh
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
```

`ELEVENLABS_API_KEY` is required whenever Herbert synthesizes
`spokenMessage` audio or runs `audio:test`. `ELEVENLABS_VOICE_ID` is optional;
when unset, Herbert uses the configured default voice id.

## Config

ElevenLabs defaults live in `packages/server/src/constants/elevenlabs.ts`.

- `spokenMessagePlaybackEnabled`: when `false`, Herbert still produces
  `spokenMessage` text and persists it in response history, but the server
  skips ElevenLabs synthesis and local playback. Flip to `true` to re-enable
  the audio side. `audio:test` is unaffected by this flag.
- `defaultSpeechModel`: `eleven_multilingual_v2` — ElevenLabs model id for
  speech generation.
- `defaultSpeechVoiceId`: `jvcMcno3QtjOzGtfpjoI` — default voice id selected
  from the ElevenLabs voice library for Herbert.
- `defaultSpeechOutputFormat`: `mp3_44100_128` — default ElevenLabs output
  format.
- `defaultSpeechStability`: `0.5` — default voice stability.
- `defaultSpeechSimilarityBoost`: `0.75` — default clarity/similarity boost.
- `defaultSpeechStyle`: `0` — default style exaggeration.
- `defaultSpeechUseSpeakerBoost`: `true` — default speaker boost setting.
- `defaultSpeechSpeed`: `1.0` — normal speech speed.
- `defaultSpeechRequestTimeoutMs`: `30000` — timeout for a single ElevenLabs
  speech generation request.

## Spoken Commentary

OpenAI still decides whether to return `spokenMessage`; ElevenLabs only renders
that text to audio. Server flow when `spokenMessage` is non-null and
`elevenLabsConfig.spokenMessagePlaybackEnabled` is `true`:

1. `handleRobotTaskResponse` calls `synthesizeSpeech` with the text.
2. `synthesizeSpeech` calls ElevenLabs `POST /v1/text-to-speech/:voice_id` with
   the configured model, output format, and voice settings.
3. `playAudioFile` invokes the platform audio player (`afplay` on macOS,
   `aplay` on Linux) as a fire-and-forget child process so it does not block
   the next Telegram turn.

When `spokenMessagePlaybackEnabled` is `false`, the synthesize/play steps are
skipped entirely; the `spoken` log line is still printed and the text is
persisted in response history so future turns know what Herbert "would have"
said.

Playback errors are logged but never surfaced to the user — the Telegram
response and queued robot actions still flow normally if audio is unavailable.

## Audio Test

Use `audio:test` to generate and play a one-off ElevenLabs speech sample from
the operator CLI:

```sh
bun herbert audio:test "Testing Herbert audio."
bun herbert audio:test "Testing another voice." --voice-id jvcMcno3QtjOzGtfpjoI
bun herbert audio:test "Testing an alias." --voice=jvcMcno3QtjOzGtfpjoI
bun herbert audio:test "Testing speed." --speech-speed 1.1
bun herbert audio:test "Testing settings." --stability 0.45 --similarity-boost 0.8 --style 0.1 --no-speaker-boost
bun herbert audio:test "Generate only." --output tmp/audio-test.mp3 --no-play
```

The command defaults to `elevenLabsConfig`. Use `--model`, `--voice-id`,
`--voice`, `--format`, `--stability`, `--similarity-boost`, `--style`,
`--speaker-boost`, `--no-speaker-boost`, `--speech-speed`, `--output`,
`--player`, `--generate-timeout-ms`, `--play-timeout-ms`, and `--no-play` to
override those values for a local test run. Value options accept either
`--flag value` or `--flag=value`. When `--output` is omitted, `audio:test`
writes the generated file under `tmp/herbert-audio/` and prints the path in the
`generated` line.

`--format` accepts either an ElevenLabs output format such as
`mp3_44100_128`, or the aliases `mp3`, `wav`, and `opus`, which map to
`mp3_44100_128`, `wav_44100`, and `opus_48000_96`. Some higher-quality formats
require higher ElevenLabs subscription tiers; `mp3_44100_128` is the safest
default.

Sources:

- [ElevenLabs create speech](https://elevenlabs.io/docs/api-reference/text-to-speech/convert)
- [ElevenLabs voice settings](https://elevenlabs.io/docs/api-reference/voices/settings/get)
- [ElevenLabs voice ids](https://help.elevenlabs.io/hc/en-us/articles/14599760033937-How-do-I-find-the-voice-ID-of-my-voices-via-the-website-and-API)
