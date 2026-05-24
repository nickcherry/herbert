# Shared Package

`packages/shared` contains Zod schemas and TypeScript types for boundaries
crossed by more than one package.

It defines:

- the JSONL protocol between TypeScript and Python,
- the HTTP contracts shared by `packages/robot` and `packages/server`.

## Rules

- Start with a Zod schema for boundary data.
- Export the TypeScript type from the schema.
- Keep domain behavior out of `packages/shared`.
- Prefer narrow command unions over broad records or stringly typed payloads.

## Subpath Exports

- `@herbert/shared/commands` - JSONL command and bridge response shapes.
- `@herbert/shared/serverApi` - HTTP path constants and response shapes for
  photo upload, video frame upload, video status, browser video routes, and
  remote manual-control commands.
- `@herbert/shared` - aggregate export for the same public schemas.
