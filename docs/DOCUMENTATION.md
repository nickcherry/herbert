# Documentation

Docs should let a future reader recover intent without the original
conversation.

Document:

- runtime contracts
- external SDK assumptions
- hardware safety behavior
- operational commands
- decisions that would otherwise look arbitrary

Do not document obvious control flow.

Update docs when changing:

- CLI behavior
- JSONL command protocol
- Python SDK usage
- motor or camera angle limits
- safety timeout behavior
- Telegram admin command contracts
- OpenAI prompt contracts, schemas, model defaults, or image input handling

When implementation relies on SunFounder behavior, link the relevant official
docs from the subsystem doc.
