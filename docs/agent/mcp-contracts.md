# MCP tool contracts

Every MCP tool must have:

- a clear name;
- a concise and accurate description;
- typed input and output schemas, preferably using Zod;
- predictable behavior;
- safe error handling;
- tests for success and failure paths.

If required coverage is missing but the user did not authorize new tests, do not add it silently. Report the gap and request that test creation be included in
the scope.

Tool handlers should validate input, delegate application behavior to services, and serialize a clear MCP-compatible result. They must not perform direct
Fitatu HTTP calls or expose raw upstream responses unless the upstream shape is intentionally part of the public contract and is safe to return.

Whenever a tool contract, service model, API mapping, or accepted identifier changes:

1. Update the corresponding Zod `inputSchema` and `outputSchema` in the same change.
2. Keep tool and field descriptions synchronized with actual runtime constraints.
3. Verify the JSON Schema published by the MCP SDK, especially for Zod refinements that may not be representable in JSON Schema.
4. Update existing MCP contract tests to cover the constraint and serialized schema where practical.
