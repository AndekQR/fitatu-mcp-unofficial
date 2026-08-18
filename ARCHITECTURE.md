# Architecture

This document is the architectural map for the TypeScript Fitatu MCP server. Read it before adding or changing a feature, public model, service contract, API
mapping, or MCP schema. When code and this document disagree, verify the intended design before extending the inconsistency.

## 1. Project structure

The tree below shows the architectural directories and representative files. It intentionally omits generated output and local-only directories such as
`node_modules/`, `dist/`, `coverage/`, IDE settings, and temporary files.

```text
fitatu_mcp_ts/
├── src/
│   ├── index.ts                         # process entry point and MCP tool registration
│   ├── McpHttpServer.ts                 # Streamable HTTP MCP transport
│   ├── config.ts                        # environment parsing and validation
│   ├── logger.ts                        # process-wide logging configuration
│   ├── tools/                           # MCP boundary
│   │   ├── addMealItems/
│   │   ├── currentUser/
│   │   ├── dayPlanItems/
│   │   ├── dietSummary/
│   │   ├── mealItems/
│   │   ├── recipes/
│   │   ├── searchFood/
│   │   └── shared/                      # MCP result, schema, and safe-error helpers
│   ├── services/                        # application and domain behavior
│   │   ├── ApplicationServices.ts       # composition root for clients and services
│   │   ├── currentUser/
│   │   ├── dayPlan/
│   │   ├── dietSummary/
│   │   ├── foodSearch/
│   │   └── recipes/
│   ├── api/                             # Fitatu HTTP boundary
│   │   ├── auth/
│   │   ├── dayPlan/
│   │   ├── dietAndActivityPlan/
│   │   ├── dietPlan/
│   │   ├── fitatuApiClientBase/
│   │   ├── foodSearch/
│   │   ├── recipes/
│   │   └── users/
│   └── shared/                          # layer-neutral utilities and technical errors
├── tests/
│   ├── fixtures/                        # reusable test data
│   ├── integration/                     # tests against Fitatu
│   └── unit/                            # deterministic tests and test doubles
├── AGENTS.md                            # repository-wide implementation rules
├── ARCHITECTURE.md                      # this architectural map
├── PYTHON_REFERENCE_ENDPOINTS.md        # read-only endpoint research
├── README.md                            # user-facing setup and operation
├── package.json                         # scripts, dependencies, and package metadata
├── tsconfig.json                        # production TypeScript configuration
└── vitest*.config.ts                    # unit and integration test configuration
```

Update this tree when a change introduces, removes, or repurposes an architectural directory. Do not add every source file; the tree should remain a quick map
of responsibilities.

## 2. Layers and responsibilities

The normal dependency and request flow is:

```text
MCP client
   │
   ▼
transport and bootstrap (`index.ts`, `McpHttpServer.ts`)
   │
   ▼
MCP tools (`src/tools`)
   │
   ▼
application services (`src/services`)
   │
   ▼
Fitatu API clients (`src/api`)
   │
   ▼
Fitatu HTTP API
```

Dependencies should point downward through this flow. A lower layer must not import a higher layer. Cross-cutting helpers in `src/shared` must remain
independent of feature workflows and MCP presentation concerns.

### 2.1 Bootstrap, composition, and transport

**Location:** `src/index.ts`, `src/McpHttpServer.ts`, `src/config.ts`, and `src/logger.ts`.

This layer:

- validates process configuration;
- creates clients and services through the composition root;
- registers MCP tools;
- selects and starts the stdio or Streamable HTTP transport;
- manages HTTP MCP sessions and graceful shutdown;
- configures safe process-level logging.

It must not contain Fitatu response mapping, domain policy, or feature workflows. `ApplicationServices` is the process-wide composition root: tools receive
services from it rather than constructing or importing HTTP clients directly.

### 2.2 MCP tool layer

**Location:** `src/tools`.

Tools are adapters between the MCP protocol and application services. A tool:

- declares its name and concise description;
- declares Zod input and output schemas;
- validates MCP input before any Fitatu request;
- converts validated input into service calls;
- maps service results into the public MCP contract;
- converts known failures into safe, actionable MCP responses.

Tool handlers should remain thin. They must not perform HTTP calls, orchestrate multi-call use cases, enforce domain policy, or expose raw upstream responses.
Plain objects are appropriate here for final MCP/Zod serialization.

Whenever a tool contract, service model, API response mapping, or accepted identifier format changes, update the corresponding input and output schemas in the
same change. Keep field descriptions aligned with runtime constraints and verify the JSON Schema emitted by the MCP SDK, especially for Zod refinements that
may not be representable in JSON Schema.

### 2.3 Service layer

**Location:** `src/services`.

Services own application use cases and the business meaning of Fitatu data. This layer:

- normalizes application input;
- maps upstream data into application or domain models;
- coordinates one or more API client calls;
- filters, ranks, deduplicates, and enriches results;
- enforces domain rules and mutation confirmation policies;
- decides whether partial failures are acceptable;
- combines results and produces caller-facing warnings or service errors.

Services depend on narrow behavior ports where practical, and their dependencies are injected. This keeps orchestration, mapping, and policy testable without
HTTP. When a service accumulates unrelated private helpers, extract cohesive behavior into a named service-layer collaborator rather than moving the workflow
into an API client or retaining one large class.

### 2.4 Fitatu API layer

**Location:** `src/api`.

The API layer is the technical Fitatu HTTP boundary. It owns:

- endpoint selection and URL construction;
- paths, query parameters, headers, and request bodies;
- authentication and session refresh;
- technical retry and endpoint fallback behavior;
- transport and HTTP status handling;
- JSON decoding and technical response validation;
- safe mapping of transport and upstream failures;
- returning the response received from Fitatu in a form safe for the service layer to consume.

API clients do not interpret business meaning or coordinate application use cases. They must not rank or filter domain results, deduplicate business entities,
enrich results with unrelated calls, aggregate use-case queries, build user-facing warnings or display values, or enforce domain policy.

Technical decoding may remain at this boundary when it only establishes that a payload can be consumed safely. Mapping upstream fields into application or
domain models belongs outside the client. API-specific request and response structures may live beside their client; they must not become accidental public
service contracts.

### 2.5 Shared utilities

**Location:** `src/shared` and, for MCP-specific helpers, `src/tools/shared`.

`src/shared` contains small, layer-neutral utilities and technical errors that are useful across multiple features. A shared module must not depend on a tool,
service workflow, or concrete Fitatu feature client. Prefer keeping a helper with its owning feature until there is demonstrated cross-feature reuse.

`src/tools/shared` is not layer-neutral. It contains reusable MCP schema, serialization, result, logging, and safe-error helpers and may be used only at the MCP
boundary.

### 2.6 Tests

**Location:** `tests` and colocated configuration tests such as `src/config.test.ts`.

- Unit tests exercise deterministic behavior with test doubles and no real credentials.
- Integration tests exercise the Fitatu boundary with the authenticated user's account and may read or mutate personal data.
- Fixtures hold reusable, non-secret test data.
- Support helpers and test doubles are test infrastructure, not production-layer abstractions.

Tests should mirror the production area they protect. Never place credentials, tokens, cookies, personal nutrition logs, or captured private responses in a
fixture or committed test output.

## 3. Boundary decision guide

Use this table before placing new behavior:

| Behavior | Owner |
| --- | --- |
| Register a tool or define its Zod/JSON Schema contract | `src/tools` |
| Format a service result as MCP content | `src/tools` |
| Normalize user intent or apply a domain rule | `src/services` |
| Coordinate several Fitatu calls | `src/services` |
| Filter, rank, deduplicate, enrich, or create user-facing warnings | `src/services` |
| Construct an endpoint, header, query, or HTTP body | `src/api` |
| Refresh authentication or map an HTTP/transport failure | `src/api` |
| Decode enough of an upstream payload to consume it safely | `src/api` |
| Convert upstream fields into an application/domain model | `src/services` or a focused service-owned mapper |
| Serialize a model into the public MCP output shape | `src/tools` |
| Wire concrete dependencies together | `ApplicationServices` |
| Provide a truly layer-neutral utility | `src/shared` |

## 4. Data model rules

### 4.1 Use real class instances

Production data models are classes with constructors or named factories that create real runtime instances. A method whose declared return type is a class must
return an instance of that class, never an object literal that merely has the same fields.

This prevents TypeScript structural compatibility from bypassing constructors, invariants, and runtime identity. A plain object can satisfy a class type at
compile time even though no constructor ran and `instanceof` cannot recognize it.

### 4.2 Construction

- Data received from Fitatu is validated and mapped by a named factory, normally `fromApiResponse()`, backed by a private constructor.
- Models created from trusted internal data use a public constructor or a precisely named factory.
- Every declared field is assigned during construction.
- Do not create classes containing only `declare` fields and populate them with structurally compatible object literals.
- Do not introduce a parallel `*Props`, `*Data`, or object type that merely repeats every field of a class for its constructor.

### 4.3 Canonical models and extensions

Keep one canonical base model for one concept. Add another model only when it represents a genuinely different state or contract.

Use inheritance only for a true subtype relationship. An extended model should accept and retain the canonical base instance plus its additional data instead
of recreating the base contract with `Omit`, `Partial`, intersections, or copied fields. Prefer composition when the additional data is enrichment rather than
an `is-a` relationship.

Models must represent valid states explicitly. Do not use `Partial<BaseModel>` or the presence of an unrelated optional field as a hidden discriminator
between incomplete and complete variants.

For example, recipe search has two meaningful states:

- `RecipeSearchItem` is the canonical summary;
- `DetailedRecipeSearchItem extends RecipeSearchItem` is the enriched state and contains complete recipe details.

An MCP mapper may flatten this internal structure when required by the external tool contract.

## 5. TypeScript declaration rules

Use a `class` for data returned, stored, or passed as a production model.

Use an `interface` for behavior, dependency-injection ports, and technical collaboration contracts. Technical options and local parameters may also use
interfaces when they do not pretend to be domain or application models.

Use a `type` alias only where TypeScript has no clearer nominal model, including:

- literal unions;
- discriminated unions;
- types inferred from Zod schemas;
- compile-time operation-name or error unions;
- similar compile-time-only expressions that do not duplicate an object model.

Do not use `type` for an object data model or derive a near-copy of an existing model with `Omit`, `Partial`, intersections, or repeated fields.

## 6. Structural objects at boundaries

Plain structural objects are appropriate for:

- technical configuration;
- dependency ports;
- private local helper structures;
- upstream request structures where class identity adds no value;
- final MCP/Zod serialization.

MCP mappers may return plain objects because their runtime contract is schema validation and serialization, not class identity. This exception does not permit
service or API methods to return plain objects under a class return type.

## 7. Errors, logging, and sensitive data

Use explicit errors for invalid input, authentication failures, Fitatu HTTP failures, invalid upstream shapes, and service-level failures. Map errors at the
boundary that has enough context to make them actionable without leaking internals.

MCP responses and logs must not expose:

- access or refresh tokens;
- cookies or authorization headers;
- credentials;
- full request bodies containing personal data;
- full upstream responses containing personal data;
- raw stack traces.

API clients may retain technical failure context needed for safe handling. Services decide the caller-facing meaning, and tools produce the final safe MCP
representation.

## 8. Change workflow for agents

Before implementing an architectural change:

1. Locate the owning layer with the structure map and boundary decision guide.
2. Reuse the canonical model and existing service or client contract where possible.
3. Keep dependencies directed from tools to services to API clients.
4. Validate external data before constructing production models.
5. Update affected MCP input and output schemas together with contract changes.
6. Modify existing tests when required to keep them consistent; follow `AGENTS.md` before adding tests.
7. Update this document when the change alters a layer responsibility, dependency direction, canonical modeling rule, or architectural directory.

## 9. Review checklist

For every architectural review, verify that:

- new behavior is in the layer that owns it;
- tools do not call Fitatu clients directly;
- clients contain HTTP concerns rather than application workflows;
- multi-call orchestration, domain policies, and caller-facing warnings remain in services;
- a new model represents a distinct concept, state, or external contract;
- an existing canonical model cannot be reused, composed, or genuinely extended;
- every class-returning production path constructs a real instance;
- parsing external data includes validation;
- no object alias or interface duplicates a model class;
- serialization-only plain objects remain confined to their boundary;
- public MCP schemas match runtime constraints and service behavior;
- errors and logs are actionable without exposing secrets or personal data.

These rules are enforced through repository instructions and review rather than a custom AST lint rule. Valid structural objects at technical boundaries make a
general lint rule too unreliable.
