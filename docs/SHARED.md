# Shared Package

`packages/shared` contains TypeScript types and Zod schemas that are expected to
be shared across boundaries.

Today it defines the JSONL protocol between the Bun process and the Python
bridge, plus the small HTTP API contracts shared by `packages/robot` and
`packages/server`. Later it should also define the command payloads exchanged
between a phone/server control plane and Herbert's local robot process.

## Rules

- Start with a Zod schema for boundary data.
- Export the TypeScript type from the schema.
- Keep domain behavior out of `packages/shared`.
- Prefer narrow command unions over broad records or stringly typed payloads.

The package currently exports:

- `robotCommandPayloadSchema`
- `robotCommandSchema`
- `bridgeResponseSchema`
- `robotPhotoUploadResponseSchema`
- `robotTaskActionSchema`
- `robotTaskActionBatchSchema`
- robot action batch HTTP response schemas
- `speechTextSchema`
- `speechLanguageSchema`
- command limit constants
- inferred TypeScript types for those schemas
