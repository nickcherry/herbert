# Coding Conventions

## Key Principles

- Optimize for reviewability. Names, structure, and control flow should make
  intent clear without prose.
- Type safety is required. Do not use `any`. Avoid `as` casts in normal
  application flow.
- Prefer simple, obvious code over clever abstractions.
- Treat hardware and process boundaries as validation boundaries.

## Stack

- Bun for runtime, package management, tests, and CLI entrypoints.
- TypeScript with strict static validation through `tsc`.
- Zod for boundary validation and schema-first typing.
- Python only at the PiCar-X hardware edge.

## Repository Layout

- `packages/robot` is the process that runs on Herbert.
- `packages/server` is the process that runs on the Mac mini.
- `packages/shared` is shared TypeScript schema/type code.
- `packages/robot/python` contains the isolated Python hardware bridge.
- `packages/cli/src/bin/index.ts` is the single operator CLI entrypoint.
- Internal engineering and architecture docs live under `docs/`.
- Scratch artifacts belong in gitignored `tmp/`.

## Modules And Files

- Use named exports only. Do not use default exports.
- Prefer one exported function per file when practical.
- Name files after the primary exported symbol when practical.
- Keep imports static and at the top of the file.
- Use absolute internal imports via `@herbert/*` instead of source-relative paths.

## Function And API Design

- Prefer object parameters for public functions.
- Use explicit return types on exported functions.
- Mark object parameter properties `readonly` when the function does not mutate
  them.
- Make invalid states hard to represent through types and schemas.

## Testing

- Unit test pure parsing, validation, and composition logic.
- Do not require PiCar-X hardware in unit tests.
- Keep hardware checks behind `--mock` or explicit operator commands.

## Boundaries

- CLI files should stay thin: parse input, call library code, print results.
- Python bridge code should stay close to SDK calls.
- Shared package code should define contracts, not behavior.
- Logs and errors should be actionable and high signal.
- Operator workflows belong behind `bun herbert <command>`, not package-local
  CLI binaries.
- Use `picocolors` for operator-facing terminal styling. Prefer bold labels and
  dim key names over raw ANSI escape codes.
- Raw terminal workflows must print status for keypresses because the terminal
  does not echo typed characters in raw mode.
- Server HTTP endpoint implementations belong under
  `packages/server/src/server/routes`, one file per route. `createServerFetch`
  should stay focused on route dispatch.

## Environment And Config

- Environment variables are for secrets, machine-local credentials, and
  deployment-local identities such as admin chat ids.
- Normal runtime tuning config belongs in a sensibly scoped typed constants file.
- Keep constants near the package or subsystem that owns them.
- Do not add env vars for tuning values such as polling intervals, batch sizes,
  or command defaults.
- Database connection settings are environment variables because they contain
  credentials and deployment-local connection details. Prefer the runtime's
  native database env handling when it exists, such as Bun SQL's MySQL env
  resolution, instead of wrapping those variables manually.
