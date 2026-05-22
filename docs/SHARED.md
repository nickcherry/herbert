# Shared Package

`packages/shared` contains Zod schemas and TypeScript types for boundaries
crossed by more than one package.

It currently defines the JSONL protocol between TypeScript and Python, plus the
HTTP contracts shared by `packages/robot` and `packages/server`.

## Rules

- Start with a Zod schema for boundary data.
- Export the TypeScript type from the schema.
- Keep domain behavior out of `packages/shared`.
- Prefer narrow command unions over broad records or stringly typed payloads.

The package currently exports:

- `robotCommandPayloadSchema`
- `robotCommandSchema`
- `bridgeResponseSchema`
- `takePhotoResultSchema`
- `cameraCheckResultSchema`
- `robotPhotoUploadResponseSchema`
- `robotTaskActionSchema`
- `robotTaskActionBatchSchema`
- `robotTaskActionBatchPollResponseSchema`
- `robotTaskActionBatchCompleteResponseSchema`
- robot HTTP path constants
- `speechTextSchema`
- `speechLanguageSchema`
- command limit constants
- inferred TypeScript types for those schemas
