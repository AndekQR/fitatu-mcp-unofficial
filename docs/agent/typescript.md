# TypeScript and code organization

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

For dependencies throughout the application:

- type constructor parameters, stored fields, and collaborators as their existing declared class or interface directly;
- do not use `Pick<ExistingType, ...>` to narrow a dependency and do not introduce a local interface that merely repeats selected members of an existing
  type;
- when a test fake replaces a class dependency, make it extend the original class and override only the methods needed by the test;
- when a test fake replaces an interface dependency, make it implement the original complete interface;
- construct class bases with safe deterministic collaborators so an unexpected call fails without using credentials or real HTTP.

Avoid:

- `any` without a strong, documented reason;
- global mutable state;
- hard-coded secrets;
- unexplained magic values;
- near-copy data models built with `type`, `Omit`, `Partial`, intersections, or repeated fields;
- long functions that mix validation, HTTP communication, mapping, domain logic, and MCP formatting;
- large procedural handlers when a client, service, typed error, or focused collaborator provides a clearer boundary.

The complete model construction and declaration rules are in [ARCHITECTURE.md](../../ARCHITECTURE.md). In particular, a method declaring a class return type must
return a real instance of that class, not a structurally compatible object literal.
