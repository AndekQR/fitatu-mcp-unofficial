# Workflow and final review

## Agent workflow

For implementation work:

1. Read the relevant repository instructions and inspect the affected code before editing.
2. Identify the owning layer using [ARCHITECTURE.md](../../ARCHITECTURE.md).
3. Check `package.json` before choosing commands.
4. Make the smallest cohesive change that fully satisfies the request.
5. Keep related runtime contracts, Zod schemas, field descriptions, and existing tests synchronized.
6. Run verification proportionate to the change, using the commands defined in `package.json`.
7. Review the final diff for accidental changes, sensitive data, architectural violations, and stale documentation.
8. Report what changed, which checks ran, and any remaining risk or unverified behavior.

For read-only review or diagnosis, inspect and report evidence without changing code unless the user also asks for a fix.

## Commit messages

When committing, prefer at least two complete sentences. Use the first sentence as a concise summary and the following sentence or sentences to describe the
most important behavioral, architectural, or operational details.

Conventional Commit prefixes such as `feat:`, `fix:`, or `refactor:` are optional. Use one only when it improves clarity.

## Final review checklist

Before handing work back, verify that:

- the requested scope is complete and unrelated user changes remain untouched;
- the implementation follows the dependency direction and ownership rules in [ARCHITECTURE.md](../../ARCHITECTURE.md);
- external inputs and responses are validated at the correct boundary;
- MCP schemas, descriptions, service contracts, and runtime behavior agree;
- errors and logs do not leak secrets or personal data;
- configuration and documentation are synchronized where relevant;
- only authorized test changes were made;
- relevant commands were run from `package.json`, or omitted checks are explicitly reported;
- the final diff contains no accidental generated files or unrelated formatting changes.
