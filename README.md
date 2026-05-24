# Herbert

Herbert is a Bun/TypeScript control project for a SunFounder PiCar-X robot car.
The repo treats Python as a narrow hardware bridge and keeps command routing,
operator interfaces, and network coordination in TypeScript.

## Docs

- [Architecture](./docs/ARCHITECTURE.md) - package boundaries and runtime flows.
- [Robot Package](./docs/ROBOT.md) - keyboard control and hardware assumptions.
- [Server Package](./docs/SERVER.md) - HTTP server and Telegram photo relay.
- [Telegram](./docs/TELEGRAM.md) - Bot API setup and helper commands.
- [OpenAI](./docs/OPENAI.md) - generic schema-first prompt helper and image inputs.
- [Python Bridge](./docs/PYTHON_BRIDGE.md) - JSONL protocol and PiCar-X SDK isolation.
- [Shared Package](./docs/SHARED.md) - schemas and types shared across process boundaries.
- [Coding Conventions](./docs/CODING_CONVENTIONS.md) - TypeScript style and repo expectations.
- [Documentation](./docs/DOCUMENTATION.md) - when and where to update docs.
- [How To Work With Nick](./docs/HOW_TO_WORK_WITH_NICK.md) - collaboration preferences.

## Common Commands

```sh
bun install
bun herbert --help
bun herbert robot:keyboard --mock
bun herbert robot:video-stream --mock --once
bun herbert robot:bridge-check --mock
bun herbert robot:camera-check --mock
bun herbert robot:photo-check --mock
bun herbert server:start
bun herbert telegram:updates
bun typecheck
bun test
```

Use `--mock` from a laptop or any machine without the PiCar-X SDK installed.
Run without `--mock` on Herbert's Raspberry Pi.

For browser driving, run `bun herbert server:start` on the Mac mini, run
`bun herbert robot:video-stream` on Herbert, then open the Mac mini server URL
in a browser.
