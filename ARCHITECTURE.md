# Architecture

This document records project-wide architectural rules and the reasoning behind them. Read it before introducing or changing public models, service contracts,
or mappings between layers.

## Data models use real class instances

Production data models are classes with constructors or named factories that create real runtime instances. A method whose declared return type is a class must
return an instance of that class; it must not return an object literal that merely has the same fields.

This rule deliberately avoids relying on TypeScript's structural compatibility for domain and application models. Structural compatibility can make a plain
object look like a class at compile time even though no constructor ran, no invariant was enforced, and `instanceof` does not recognize the value.

### Construction

- Data received from Fitatu is validated and mapped by a named factory, normally `fromApiResponse()`, backed by a private constructor.
- Models created from trusted internal data use a public constructor or a precisely named factory.
- Every declared field is assigned during construction.
- Do not create classes that contain only `declare` fields and are populated through structurally compatible object literals.
- Do not introduce a parallel `*Props`, `*Data`, or object type that merely repeats every field of a class for its constructor.

### Base models and extensions

There must be one canonical base model for one concept. Introduce another model only when it represents a genuinely different state or contract.

Use inheritance only for a real subtype relationship. An extended model should accept and retain the canonical base instance plus its additional data rather
than recreate the base contract with `Omit`, `Partial`, intersections, or copied fields. Prefer composition when the added data is enrichment rather than an
`is-a` relationship.

Models must represent valid states explicitly. Do not use `Partial<BaseModel>` or the presence of an unrelated optional field as a hidden discriminator between
incomplete and complete variants.

For example, recipe search has two meaningful states:

- `RecipeSearchItem` is the canonical summary.
- `DetailedRecipeSearchItem extends RecipeSearchItem` is the enriched state and contains complete recipe details.

The MCP mapper may flatten this internal structure when required by the external tool contract.

## Appropriate TypeScript declarations

Use a `class` for data returned, stored, or passed as a production model.

Use an `interface` for behavior, dependency-injection ports, and technical collaboration contracts. Technical options and local parameters may also use
interfaces when they are not pretending to be domain or application models.

Use a `type` alias only where TypeScript has no clearer nominal model:

- literal unions,
- discriminated unions,
- types inferred from Zod schemas,
- compile-time operation-name or error unions,
- similar compile-time-only expressions that do not duplicate an object model.

Do not use `type` for an object data model or to derive a near-copy of an existing model with `Omit`, `Partial`, intersections, or field repetition.

## Structural objects at boundaries

Plain structural objects remain appropriate for:

- technical configuration,
- dependency ports,
- private local helper structures,
- final MCP/Zod serialization.

MCP mappers may return plain objects because their runtime contract is validation and serialization through a schema, not class identity. This exception does
not permit service or API methods to return plain objects under a class return type.

## Review expectations

When reviewing model changes, verify that:

- a new model represents a distinct concept, state, or external contract;
- an existing canonical model cannot be reused or genuinely extended;
- every class-returning production path constructs a real instance;
- parsing external data passes through validation;
- no object alias or interface duplicates a model class;
- serialization-only plain objects remain confined to their boundary.

These rules are enforced through repository instructions and review rather than a custom AST lint rule, because valid structural objects at technical boundaries
would make a general rule unreliable.
