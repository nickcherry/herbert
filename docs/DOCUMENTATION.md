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
- polling or server-to-robot command contracts
- Telegram admin command contracts
- server-to-robot command queue behavior
- OpenAI prompt contracts, schemas, model defaults, or image input handling
- persistence table layout, event schemas, or migration assumptions

When implementation relies on SunFounder behavior, link the relevant official
docs from the subsystem doc.
