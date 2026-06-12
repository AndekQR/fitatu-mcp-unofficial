# Repository Guidelines

## Project Purpose

This repository is intended to implement a Model Context Protocol server for Fitatu in TypeScript.

The project should use the official Model Context Protocol TypeScript SDK as the primary reference for MCP server, tool, and resource implementation patterns.

Any existing Python implementation should be treated only as a read-only reference. It may help identify possible Fitatu endpoints, request payloads, response shapes, tool names, or edge cases, but it should not be copied mechanically. The Python code may contain mistakes, inconsistencies, or design choices that should be improved in the TypeScript implementation.

Sometimes the existing Python project with similar might be helpful, it's under /Users/daniel/Projects/fitatu_mcp

## Build, Test, and Development Commands

Use the commands defined in `package.json`.

Common expected commands may include:

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run test`
- `npm run test:ci`
- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`

Before relying on any command, confirm that it exists in `package.json`.

## Coding Style & Naming Conventions

Use TypeScript with ES module syntax.

Prefer:

- Explicit types for public APIs.
- `camelCase` for variables, functions, methods, and object properties.
- `PascalCase` for classes, interfaces, and types.
- Descriptive names over abbreviations.
- Small modules with clear responsibilities.
- `zod` for validating external input.

Avoid:

- `any`, unless there is a strong reason.
- Global mutable state.
- Hard-coded secrets.
- Magic values without names.
- Long functions that mix validation, HTTP calls, mapping, and MCP response formatting.
- Logging tokens, cookies, authorization headers, or personal data.

## Architecture Guidelines

Keep responsibilities separated.

The implementation should distinguish between:

- MCP tool or resource registration.
- Input validation.
- Fitatu HTTP communication.
- Request and response mapping.
- Domain-level logic.
- Error handling.
- Tests.

Prefer object-oriented design where it improves encapsulation, readability, and testability. Client classes, service classes, typed errors, and small mapper functions are preferred over large procedural handlers.

Use dependency injection for configuration, logging, and HTTP clients where practical.

## MCP Tool Implementation

Each MCP tool should have:

- A clear name.
- A concise description.
- A typed input schema, preferably using `zod`.
- A handler with predictable behaviour.
- Safe error handling.
- Tests for success and failure paths.

Tool handlers should stay thin when possible. They should validate input, delegate work to client or service code, and return a clear MCP-compatible response.

Do not expose raw upstream responses unless they are intentionally part of the tool contract and safe to return.

## Fitatu HTTP Integration

Fitatu HTTP calls should be implemented through a dedicated wrapper or client layer instead of scattered direct `fetch` calls.

The HTTP layer should handle:

- Base URL configuration.
- Request headers.
- Authorization values supplied through configuration.
- Query parameters.
- JSON serialization and parsing.
- HTTP status handling.
- Safe error mapping.

Captured HTTP traffic may be used only for legitimate work with the user’s own account and own network traffic.

Do not implement functionality intended to bypass authentication, steal credentials, evade limits, scrape at scale, or access data from accounts that do not belong to the user.

## Validation & Error Handling

Validate all MCP tool inputs before making Fitatu requests.

Use explicit errors where useful, for example for:

- Authentication failures.
- Invalid input.
- HTTP errors.
- Unexpected response shapes.

Error messages should be actionable but safe.

Do not expose:

- Access tokens.
- Refresh tokens.
- Cookies.
- Authorization headers.
- Full request bodies containing personal data.
- Full upstream responses containing personal data.
- Raw stack traces in MCP-facing responses.

## Testing Guidelines

Use the test framework configured in the repository.

Do not add tests for every small change by default. Tests should be written only when explicitly requested or when the code covers critical system behaviour where a regression would be costly.

Prioritize tests for:

- Fitatu authentication or authorization handling.
- Request construction for important Fitatu API calls.
- Response mapping for core user-facing data.
- Error mapping for authentication, validation, and upstream HTTP failures.
- Configuration parsing when invalid configuration could break the server.
- MCP tools that perform important write operations or expose essential user workflows.

Avoid creating large numbers of low-value tests for trivial wrappers, simple getters, obvious type-only changes, or implementation details that are likely to change during early development.

Prefer focused tests with mocked HTTP clients over tests that depend on live Fitatu services.

Do not use real Fitatu tokens, cookies, account data, or personal nutrition data in tests. Use sanitized fixtures.

When adding tests, keep them small, readable, and tied to observable behaviour rather than internal implementation details.
## Configuration & Operational Notes

Runtime configuration should be sourced from environment variables or another explicit configuration mechanism used by the project.

Secrets must not be hard-coded or committed.

Fitatu-related credentials, tokens, cookies, user identifiers, nutrition logs, body measurements, and profile data should be treated as sensitive.

When adding configuration values, document:

- The variable name.
- Whether it is required.
- Its default value, if any.
- Whether it contains sensitive data.

## Logging

Use structured logging if the project already has a logger.

Logs should contain enough context for debugging but must not expose secrets or personal data.

Redact or omit:

- Tokens.
- Cookies.
- Authorization headers.
- Personal Fitatu account data.
- Sensitive request and response payloads.

## Working With Reference Implementations

When using a Python reference implementation, extract intent rather than structure.

Use it to understand:

- Which operations may be useful.
- Which Fitatu endpoints may be involved.
- What request payloads may look like.
- What response fields may exist.
- What edge cases were previously observed.

Before implementing the same behaviour in TypeScript, verify that the design is appropriate for the current repository.

Prefer a cleaner TypeScript implementation using explicit types, validation, dependency injection, safe errors, and small modules.