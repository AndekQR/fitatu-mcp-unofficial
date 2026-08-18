![Fitatu MCP Unofficial logo](./fitatu_mcp_logo.png)

# Fitatu MCP Unofficial

Unofficial Model Context Protocol (MCP) server for accessing and updating data in your own Fitatu account. It provides typed tools for profile data, meal
plans, nutrition summaries, food search, and recipe management over stdio or Streamable HTTP.

> [!IMPORTANT]
> This project is not affiliated with, endorsed by, or sponsored by Fitatu. Use it only with your own account and treat Fitatu credentials and account data as
> sensitive.

## Features

- Profile, day-plan, and nutrition summary queries.
- Food and recipe search with identifiers required by mutation tools.
- Meal item creation, update, replacement, movement, and removal.
- Recipe creation, inspection, update, and deletion.
- MCP transports for local stdio and Streamable HTTP clients.
- Local development and Docker workflows.

## Requirements

- Node.js `>=22.18.0`
- npm
- A Fitatu account

Docker and `cloudflared` are optional and required only for their respective workflows.

## Quick start

Install dependencies and create the local configuration file:

```bash
npm install
cp .env.example .env
```

Set `FITATU_EMAIL` and `FITATU_PASSWORD` in `.env`, then start the development server:

```bash
npm run dev
```

The default MCP endpoint is `http://localhost:3000/mcp`.

## MCP client configuration

Choose one transport with `MCP_TRANSPORT`:

| Transport | Best for | Process model |
| --- | --- | --- |
| `stdio` | A local client that launches its own MCP server | One server process per client |
| `http` | A persistent server shared by one or more clients | Long-running server on `/mcp` |

### stdio

Build the server before configuring the client:

```bash
npm run build
```

Use absolute paths to the repository's `.env` and `dist/index.js` files:

```json
{
	"mcpServers": {
		"fitatu": {
			"command": "node",
			"args": [
				"--env-file=/absolute/path/to/fitatu-mcp-unofficial/.env",
				"/absolute/path/to/fitatu-mcp-unofficial/dist/index.js"
			],
			"env": {
				"MCP_TRANSPORT": "stdio"
			}
		}
	}
}
```

The client starts and stops the server. In stdio mode, logs are written to stderr because stdout is reserved for the JSON-RPC stream.

### Streamable HTTP

Start the server with `npm run dev`, or build and run it with:

```bash
npm run build
npm start
```

Clients with native Streamable HTTP support can connect directly to:

```text
http://localhost:3000/mcp
```

For a client that launches remote MCP connections through a command, use `mcp-remote`:

```json
{
	"mcpServers": {
		"fitatu": {
			"command": "npx",
			"args": ["mcp-remote", "http://localhost:3000/mcp"]
		}
	}
}
```

To inspect the local server interactively:

```bash
npm run inspector
```

Connect the Inspector to `http://localhost:3000/mcp`.

#### Temporary Cloudflare Tunnel

Install `cloudflared`, start the HTTP server locally, and run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Append `/mcp` to the public URL printed by `cloudflared` and use the result as the MCP endpoint.

> [!WARNING]
> The MCP server has no separate application-level access control. Anyone who can reach the tunnel URL may be able to invoke tools against the configured
> Fitatu account. Use a public tunnel only for controlled, temporary testing and close it immediately afterward.

## Available tools

| Tool | Purpose |
| --- | --- |
| `get_current_user` | Return a safe subset of the authenticated user profile. |
| `get_day_plan_items` | Return meals and food items for a `YYYY-MM-DD` date. |
| `get_diet_summary` | Summarize nutrition and energy for an inclusive date range. |
| `search_food` | Search Fitatu food catalogs and return mutation-ready identifiers. |
| `add_meal_items` | Add products, recipes, or custom items to a meal. |
| `update_meal_item` | Update quantity, measure, or eaten state. |
| `replace_meal_item` | Replace one exact meal entry. |
| `move_meal_item` | Move an item to another meal, date, or both. |
| `remove_meal_items` | Atomically remove selected day-plan entries by UUID. |
| `search_recipes` | Search private recipes, public recipes, or both catalogs. |
| `get_recipe` | Return canonical per-serving recipe details. |
| `create_recipe` | Create a private recipe from product and measure identifiers. |
| `update_recipe` | Partially update an owned, editable recipe. |
| `delete_recipe` | Soft-delete a recipe after exact-name confirmation. |

## Configuration

Runtime configuration is read from environment variables and validated at startup.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FITATU_EMAIL` | Yes | — | Fitatu account email address. |
| `FITATU_PASSWORD` | Yes | — | Fitatu account password. |
| `MCP_TRANSPORT` | No | `http` | MCP transport: `http` or `stdio`. |
| `PORT` | No | `3000` | HTTP port; unused in stdio mode. |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test`. |
| `SERVER_NAME` | No | `fitatu-mcp` | Name reported by the MCP server. |
| `SERVER_VERSION` | No | `2.0.0` | Version reported by the MCP server. |
| `LOG_LEVEL` | No | `info` | `silent`, `error`, `warn`, `info`, or `debug`. |
| `FITATU_USER_AGENT` | No | `Dart/3.10 (dart:io)` | Fitatu mobile runtime user agent. |
| `FITATU_APP_VERSION` | No | `4.14.4` | Fitatu mobile application version. |
| `FITATU_API_APK_UUID` | No | `BE4B.251210.005` | Fitatu mobile build identifier. |

Do not commit `.env`. The mobile client profile defaults match Fitatu 4.14.4 traffic captured on 2026-07-30 and can be overridden without changing code.

## Docker

The current image build requires a configured `.env` file:

```bash
cp .env.example .env
docker build -t fitatu-mcp .
docker run --name fitatu-mcp -p 3000:3000 fitatu-mcp
```

The Dockerfile copies `.env` into the image. Treat the resulting image as sensitive; do not publish or share it.

## Development

| Task | Command |
| --- | --- |
| Development server | `npm run dev` |
| Production build | `npm run build` |
| Start built server | `npm start` |
| Type checking | `npm run typecheck` |
| Lint | `npm run lint` |
| Formatting check | `npm run format:check` |
| Unit tests with coverage | `npm run test:ci` |
| Local coverage report | `npm run test:coverage` |
| Integration tests | `npm run test:integration` |

`npm run test:ci` is deterministic and does not load Fitatu credentials. Integration tests require valid credentials and may read or mutate meal-plan and
recipe data in the authenticated account.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layer boundaries and design rules, and [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

Licensed under the [MIT License](./LICENSE).
