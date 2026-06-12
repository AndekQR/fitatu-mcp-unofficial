# Fitatu Credentials Configuration Design

## Scope

Add a safe runtime configuration path for Fitatu credentials. This is the first step before implementing a tool that fetches a day from Fitatu.

This design does not implement Fitatu login, session handling, HTTP calls, or the day-fetching MCP tool.

## Decisions

- Store local development credentials in a `.env` file.
- Read credentials through `process.env`, not `import.meta.env`.
- Validate configuration with the existing `zod`-based `src/config.ts` module.
- Treat Fitatu credentials as sensitive data.
- Do not log credentials, return them from MCP tools, or commit them to git.

## Environment Variables

The runtime configuration will include:

- `FITATU_EMAIL`: required Fitatu account email address. Sensitive.
- `FITATU_PASSWORD`: required Fitatu account password. Sensitive.

The repository will include `.env.example` with placeholder values and will ignore local `.env` files through `.gitignore`.

## Architecture

`src/config.ts` remains the single source of runtime configuration. It will parse `process.env` once, validate values with `zod`, and expose the typed `Config` object through `getConfig()`.

Future Fitatu client code will receive credentials from `getConfig()` or injected configuration. MCP tool handlers should not read environment variables directly.

## Why Not `import.meta.env`

This project currently runs development with `node --watch src/index.ts`, so Vite does not provide `import.meta.env` at runtime in dev. Fitatu credentials are also runtime secrets, not build-time constants.

Using `process.env` keeps development, built output, Docker, and production execution aligned.

## Error Handling

If required Fitatu credentials are missing or invalid, startup configuration parsing should fail with a safe error message. The error must not include the credential values.

## Testing

No test is required for this small configuration change unless the implementation introduces custom parsing logic beyond the existing `zod` schema.

Verification should run the existing configured commands:

- `npm run build`
- `npm run lint`
- `npm run test:ci`
