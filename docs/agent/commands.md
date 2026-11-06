# Development and verification commands

The current project commands are:

| Purpose | Command | Notes |
| --- | --- | --- |
| Single development server | `npm run dev:server` | Uses `.env`, watches sources, no ngrok. |
| Both accounts with ngrok | `npm run dev:tunnel:all` | Starts personal and test servers, gateway, and tunnel. |
| Test account with ngrok | `npm run dev:tunnel:test` | Starts test server, gateway, and tunnel. |
| Stop development processes | `npm run dev:stop` | Stops this checkout's servers and ngrok, including orphaned processes; macOS/Linux. |
| Production build | `npm run build` | Produces the distributable output. |
| Start built server | `npm start` | Requires a successful build. |
| Unit tests in watch mode | `npm run test` | Intended for interactive development. |
| Deterministic unit test run | `npm run test:ci` | Produces coverage and JSON test output. |
| Coverage report | `npm run test:coverage` | Produces local coverage reports. |
| Integration tests | `npm run test:integration` | Uses the dedicated Fitatu test account and may mutate its data. |
| Type checking | `npm run typecheck` | Checks production and test TypeScript configurations. |
| Lint | `npm run lint` | Checks source, tests, and Vitest configuration. |
| Lint with fixes | `npm run lint:fix` | Mutates files to apply supported fixes. |
| Format | `npm run format` | Mutates supported TypeScript and configuration files. |
| Format check | `npm run format:check` | Verifies formatting without changing files. |

Do not assume this table is current after `package.json` changes. The package scripts remain authoritative.
