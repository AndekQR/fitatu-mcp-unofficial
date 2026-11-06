# Agent Instructions

This repository implements an unofficial Model Context Protocol (MCP) server for Fitatu in TypeScript. These instructions define how an AI agent should work
in this repository. They apply to the entire project unless a more specific `AGENTS.md` exists in a subdirectory.

## Sources and scope

Use each source for its stated purpose:

- The user's current request defines the scope and desired outcome.
- This file and the linked documents in `docs/agent/` define repository-wide working and implementation rules.
- [ARCHITECTURE.md](./ARCHITECTURE.md) defines directory ownership, layer boundaries, dependency direction, model construction, and architectural review rules.
- `package.json` defines the available development, build, and verification commands.
- The official Model Context Protocol TypeScript SDK is the primary technical reference for MCP servers, tools, resources, schemas, and transports.

If existing code conflicts with an architectural rule, do not copy or expand the inconsistency without first determining the intended design.

## Non-negotiable rules

- Work on the current branch unless the user explicitly requests another branch.
- Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing public models, service contracts, layer mappings, or MCP contracts.
- Keep MCP tools, application services, Fitatu HTTP clients, domain mapping, and error presentation in their owning layers.
- Validate external input and upstream data at the appropriate boundary.
- Keep secrets and personal data out of source code, logs, errors, fixtures, and committed output.
- Do not add new tests unless the user explicitly requests them. Modify existing tests when needed to keep them consistent with a change.
- Confirm that a script exists in `package.json` before running it.

## Detailed instructions

Read [workflow and final review](./docs/agent/workflow.md) and [validation and security](./docs/agent/validation-and-security.md) for every task.
Read the other documents before working in their area. These documents are instructions, not optional background material.

| Document | Read when |
| --- | --- |
| [Architecture](./ARCHITECTURE.md) | Identifying layer ownership or changing features, models, service contracts, API mappings, or MCP schemas. |
| [Commands](./docs/agent/commands.md) | Choosing development, build, or verification commands; confirm scripts in `package.json`. |
| [TypeScript](./docs/agent/typescript.md) | Writing or reviewing TypeScript, models, dependencies, or test doubles. |
| [MCP contracts](./docs/agent/mcp-contracts.md) | Changing tools, schemas, descriptions, service models, API mappings, or accepted identifiers. |
| [Fitatu HTTP integration](./docs/agent/fitatu-http.md) | Working on API clients, request handling, or service orchestration. |
| [Configuration](./docs/agent/configuration.md) | Adding or changing runtime configuration. |
| [Testing](./docs/agent/testing.md) | Changing or running tests, or assessing coverage. |
