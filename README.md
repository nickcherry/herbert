# Herbert

Herbert is a Bun/TypeScript control project for a SunFounder PiCar-X robot car.
The repo treats Python as a narrow hardware bridge and keeps command routing,
operator interfaces, and future network control in TypeScript.

## Docs

- [Architecture](./docs/ARCHITECTURE.md) - package boundaries and command flow.
- [Robot Package](./docs/ROBOT.md) - local robot process, keyboard controls, and hardware assumptions.
- [Server Package](./docs/SERVER.md) - Mac mini server process and Telegram administration.
- [Telegram](./docs/TELEGRAM.md) - Telegram Bot API integration and required environment variables.
- [OpenAI](./docs/OPENAI.md) - schema-first prompt helper and image attachment support.
- [Persistence](./docs/PERSISTENCE.md) - lightweight persistence direction.
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
bun herbert server:start --no-telegram
bun typecheck
bun test
```

Use `--mock` from a laptop or any machine without the PiCar-X SDK installed.
Run without `--mock` on Herbert's Raspberry Pi.
