# Agent Instructions

This repository implements an unofficial Model Context Protocol (MCP) server for Fitatu in TypeScript. These instructions define how an AI agent should work
in this repository. They apply to the entire project unless a more specific `AGENTS.md` exists in a subdirectory.

## 1. Sources and their roles

Use each source for its stated purpose:

- The user's current request defines the scope and desired outcome.
- This file defines repository-wide working and implementation rules.
- [ARCHITECTURE.md](./ARCHITECTURE.md) defines directory ownership, layer boundaries, dependency direction, model construction, and architectural review rules.
- `package.json` defines the available development, build, and verification commands.
- The official Model Context Protocol TypeScript SDK is the primary technical reference for MCP servers, tools, resources, schemas, and transports.
- [PYTHON_REFERENCE_ENDPOINTS.md](./PYTHON_REFERENCE_ENDPOINTS.md) and the Python project at `/Users/daniel/Projects/fitatu_mcp` are read-only research sources.

If existing code conflicts with an architectural rule, do not copy or expand the inconsistency without first determining the intended design.

## 2. Non-negotiable rules

- Work on the current branch unless the user explicitly requests another branch.
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing public models, service contracts, layer mappings, or MCP contracts.
- Keep MCP tools, application services, Fitatu HTTP clients, domain mapping, and error presentation in their owning layers.
- Validate external input and upstream data at the appropriate boundary.
- Keep secrets and personal data out of source code, logs, errors, fixtures, and committed output.
- Do not add new tests unless the user explicitly requests them. Modify existing tests when needed to keep them consistent with a change.
- Confirm that a script exists in `package.json` before running it.
- Do not copy the Python reference implementation mechanically.

## 3. Agent workflow

For implementation work:

1. Read the relevant repository instructions and inspect the affected code before editing.
2. Identify the owning layer using [ARCHITECTURE.md](./ARCHITECTURE.md).
3. Check `package.json` before choosing commands.
4. Make the smallest cohesive change that fully satisfies the request.
5. Keep related runtime contracts, Zod schemas, field descriptions, and existing tests synchronized.
6. Run verification proportionate to the change, using the commands defined in `package.json`.
7. Review the final diff for accidental changes, sensitive data, architectural violations, and stale documentation.
8. Report what changed, which checks ran, and any remaining risk or unverified behavior.

For read-only review or diagnosis, inspect and report evidence without changing code unless the user also asks for a fix.

## 4. Commands

The current project commands are:

| Purpose | Command | Notes |
| --- | --- | --- |
| Development server | `npm run dev` | Runs the TypeScript entry point in watch mode. |
| Production build | `npm run build` | Produces the distributable output. |
| Start built server | `npm start` | Requires a successful build. |
| Unit tests in watch mode | `npm run test` | Intended for interactive development. |
| Deterministic unit test run | `npm run test:ci` | Produces coverage and JSON test output. |
| Coverage report | `npm run test:coverage` | Produces local coverage reports. |
| Integration tests | `npm run test:integration` | Requires valid Fitatu credentials and may mutate account data. |
| Type checking | `npm run typecheck` | Checks production and test TypeScript configurations. |
| Lint | `npm run lint` | Checks source, tests, and Vitest configuration. |
| Lint with fixes | `npm run lint:fix` | Mutates files to apply supported fixes. |
| Format | `npm run format` | Mutates supported TypeScript and configuration files. |
| Format check | `npm run format:check` | Verifies formatting without changing files. |

Do not assume this table is current after `package.json` changes. The package scripts remain authoritative.

## 5. TypeScript and code organization

Use TypeScript with ES module syntax. Use only syntax supported by Node.js in strip-only mode; do not use parameter properties such as
`constructor(public readonly value: string)`.

Prefer:

- explicit types for public APIs;
- `camelCase` for variables, functions, methods, and object properties;
- `PascalCase` for classes, interfaces, and types;
- classes for production data models, with each class in its own file;
- interfaces for behavior, ports, and technical collaboration contracts;
- type aliases for compile-time constructs such as unions and Zod-inferred types;
- descriptive names rather than abbreviations;
- small modules with clear responsibilities;
- dependency injection for configuration, logging, clients, and service collaborators where practical;
- `zod` for validating external input;
- typed errors and focused mapper functions where they improve clarity.

Avoid:

- `any` without a strong, documented reason;
- global mutable state;
- hard-coded secrets;
- unexplained magic values;
- near-copy data models built with `type`, `Omit`, `Partial`, intersections, or repeated fields;
- long functions that mix validation, HTTP communication, mapping, domain logic, and MCP formatting;
- large procedural handlers when a client, service, typed error, or focused collaborator provides a clearer boundary.

The complete model construction and declaration rules are in [ARCHITECTURE.md](./ARCHITECTURE.md). In particular, a method declaring a class return type must
return a real instance of that class, not a structurally compatible object literal.

## 6. MCP tool contracts

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

## 7. Fitatu HTTP integration

Implement Fitatu calls through the dedicated API client layer, never as scattered direct `fetch` calls.

API clients own HTTP concerns such as endpoints, request construction, authentication, technical retries or fallbacks, status and transport error mapping,
JSON decoding, and technical response validation. Services own input normalization, domain mapping, filtering, ranking, deduplication, enrichment, multi-call
orchestration, partial-failure policy, confirmation policy, and user-facing warnings.

The HTTP layer should handle:

- base URL configuration;
- request paths and query parameters;
- request headers and configured authorization values;
- JSON serialization and parsing;
- HTTP status and transport failures;
- safe technical error mapping.

Use captured HTTP traffic only for legitimate work with the user's own account and network traffic. Do not build functionality intended to bypass
authentication, steal credentials, evade limits, scrape at scale, or access accounts that do not belong to the user.

## 8. Validation, errors, and sensitive data

Validate all MCP tool inputs before making a Fitatu request. Validate upstream response shapes before using them to construct production models.

Use explicit errors where useful, including for:

- invalid input;
- authentication failures;
- HTTP or transport failures;
- unexpected upstream response shapes;
- service-level policy or confirmation failures.

Errors should be actionable but safe. Never expose or log:

- passwords or account credentials;
- access or refresh tokens;
- cookies or authorization headers;
- full request bodies containing personal data;
- full upstream responses containing personal data;
- raw stack traces in MCP-facing responses;
- personal nutrition logs, body measurements, profile data, or user identifiers unless explicitly required by a safe public contract.

## 9. Configuration

Read runtime configuration from environment variables or the repository's explicit configuration mechanism. Never hard-code or commit secrets.

When adding a configuration value, document:

- its variable name;
- whether it is required;
- its default value, if any;
- whether it is sensitive;
- its operational purpose.

Keep `.env.example`, runtime validation, and user-facing configuration documentation synchronized when applicable.

## 10. Testing

Do not add new test files or new test cases unless the user explicitly requests them. Existing tests may be updated when required by an implementation or
contract change.

- Unit tests must be deterministic and must not load real Fitatu credentials.
- Integration tests require valid credentials and may read or mutate data in the authenticated account.
- Treat integration test execution as a potentially state-changing operation.
- Keep secrets, captured private responses, and personal data out of fixtures and committed test artifacts.
- Prefer the narrowest relevant verification first, then broader checks when proportionate to the change.

## 11. Reference implementations

The Python project at `/Users/daniel/Projects/fitatu_mcp` is read-only and may contain mistakes, inconsistencies, or design choices that should not be repeated.

Use it to investigate:

- potentially useful operations;
- Fitatu endpoints;
- possible request payloads and response fields;
- tool names;
- previously observed edge cases.

Extract intent, not structure. Before implementing equivalent behavior, verify that it fits this repository's TypeScript architecture. Prefer explicit types,
validation, dependency injection, safe errors, and small focused modules.

## 12. Commit messages

When committing, prefer at least two complete sentences. Use the first sentence as a concise summary and the following sentence or sentences to describe the
most important behavioral, architectural, or operational details.

Conventional Commit prefixes such as `feat:`, `fix:`, or `refactor:` are optional. Use one only when it improves clarity.

## 13. Final review checklist

Before handing work back, verify that:

- the requested scope is complete and unrelated user changes remain untouched;
- the implementation follows the dependency direction and ownership rules in [ARCHITECTURE.md](./ARCHITECTURE.md);
- external inputs and responses are validated at the correct boundary;
- MCP schemas, descriptions, service contracts, and runtime behavior agree;
- errors and logs do not leak secrets or personal data;
- configuration and documentation are synchronized where relevant;
- only authorized test changes were made;
- relevant commands were run from `package.json`, or omitted checks are explicitly reported;
- the final diff contains no accidental generated files or unrelated formatting changes.
