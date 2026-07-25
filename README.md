![Fitatu MCP Unofficial logo](./fitatu_mcp_logo.png)

# Fitatu MCP Unofficial

Unofficial Model Context Protocol (MCP) server for Fitatu. It exposes selected Fitatu account operations as typed MCP tools so an MCP client can inspect and
update your own meal plan.

> [!IMPORTANT]
> This project is not affiliated with, endorsed by, or sponsored by Fitatu. Fitatu credentials and account data are sensitive. Use this server only with your
> own account.

## Features

- Streamable HTTP MCP endpoint at `/mcp`.
- Fitatu authentication through local environment variables.
- Safe profile and day-plan read tools.
- Diet summary tool for an inclusive date range, including period energy, key nutrients, and full nutrient details.
- Food search with product and measure identifiers for follow-up mutations.
- Meal item add, update, move, and remove tools.
- Recipe search and complete recipe lifecycle tools: create, inspect, update, and delete.
- Docker workflow for local/private deployment.

## Requirements

- Node.js `>=22.18.0`
- npm
- A Fitatu account

## Quick Start

Install dependencies:

```bash
npm install
```

Create local configuration:

```bash
cp .env.example .env
```

Fill in `FITATU_EMAIL` and `FITATU_PASSWORD` in `.env`, then start the development server:

```bash
npm run dev
```

The MCP endpoint is available at:

```text
http://localhost:3000/mcp
```

## MCP Client Setup

If your MCP client supports remote Streamable HTTP servers, use this endpoint directly:

```text
http://localhost:3000/mcp
```

For clients that launch MCP servers through a command, use `mcp-remote`:

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

When using a public tunnel, replace the local URL with the tunnel URL and keep the `/mcp` path.

To test the server manually in a browser-based tool, run the MCP Inspector and connect it to the Streamable HTTP endpoint:

```bash
npx @modelcontextprotocol/inspector
```

Use this URL in the Inspector:

```text
http://localhost:3000/mcp
```

## Available Tools

| Tool                 | Purpose                                                                             | Mutates Fitatu data |
| -------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| `get_current_user`   | Returns a safe subset of the authenticated Fitatu user profile.                     | No                  |
| `get_day_plan_items` | Returns meals and food items for a `YYYY-MM-DD` date.                               | No                  |
| `get_diet_summary`   | Returns an agent-friendly nutrition and energy summary for an inclusive date range. | No                  |
| `search_food`        | Searches Fitatu food catalogs for product, recipe, and measure identifiers.         | No                  |
| `add_meal_items`     | Adds one or more products or recipes to a meal.                                     | Yes                 |
| `update_meal_item`   | Updates quantity, measure, or eaten state for an existing meal item.                | Yes                 |
| `move_meal_item`     | Moves a meal item to another meal, date, or both.                                   | Yes                 |
| `remove_meal_items`  | Atomically removes exact day-plan entries of any food type by item UUID.             | Yes                 |
| `search_recipes`     | Lists or searches the user's recipes, public recipes, or both catalogs.             | No                  |
| `get_recipe`         | Returns canonical per-serving details for a recipe.                                 | No                  |
| `create_recipe`      | Creates a private recipe by default from product and measure identifiers.           | Yes                 |
| `update_recipe`      | Partially updates an owned, editable recipe and returns its resulting recipe ID.    | Yes                 |
| `delete_recipe`      | Soft-deletes a recipe definition after exact-name confirmation.                     | Yes                 |

Typical workflow:

1. Call `get_day_plan_items` to inspect available meals and their exact `itemId` UUIDs for a specific day.
2. Call `search_food` to find a matching `foodId`, required `foodType`, and `measureId`. Recipe identifiers use the `recipe:<digits>` format.
3. Call `add_meal_items` with the canonical `foodId`, `foodType`, and `measureId` strings. Its preflight validates every food and measure before synchronizing
   the whole batch.
4. After `add_meal_items` returns `accepted`, use its `provisionalItemIds` only as provisional identifiers. Call `get_day_plan_items` again and verify each
   requested item.
5. Use an `itemId` returned by `get_day_plan_items` with `update_meal_item` or `move_meal_item`.
6. To delete entries, pass `date` and exact `itemIds` UUIDs to `remove_meal_items`. Do not pass product or recipe definition IDs. The destructive operation
   does not require `mealKey`, validates every UUID first, and performs one atomic synchronization.

An agent may also use `get_diet_summary` to fetch periodic diet data and track nutrition over time.

Fitatu applies some mutations asynchronously, so a very fast follow-up read may briefly return the previous state. Always verify accepted mutations with a
subsequent day-plan read.

### Recipe Workflow

1. Call `search_food` to find product `foodId` and `measureId` values for recipe ingredients.
2. Call `create_recipe`; recipes are private unless `shared: true` is explicitly requested. A trimmed name must contain 1–255 characters, servings must be
   1–1000, a recipe may contain at most 50 ingredients, and each `measureQuantity` must be greater than zero and no more than 1,000,000.
3. Store the returned `recipe:<digits>` identifier. All recipe-tool inputs require that prefixed form; raw numeric recipe IDs are rejected.
4. Use `search_recipes` to list or search the authenticated user's recipes, the public catalog, or both. Queries are trimmed before matching. For
   `scope=all`, results from an available source are returned with `warnings[]` when the other source fails; the search fails only if both sources fail.
5. Call `update_recipe` only for an owned, editable recipe. Always use the returned prefixed `recipeId` afterward because Fitatu may replace the recipe and
   assign a new ID.
6. Call `delete_recipe` to soft-delete the catalog definition. It requires the current recipe name in `expectedName`; existing and historical day-plan
   snapshots are retained, while the deleted definition cannot be added again.

Recipe ingredient `itemId`/`measureId` pairs must be unique, and each measure must belong to its selected product. Custom tags are accepted only with Fitatu's
user-tag category; updates also accept categories already present on the current recipe. All recipe tools publish an MCP `outputSchema`. Invalid tool
arguments are rejected by the MCP SDK with protocol error `-32602` before the tool handler runs.

## Configuration

Runtime configuration is read from environment variables and validated at startup.

| Variable          | Required | Default       | Sensitive | Description                             |
| ----------------- | -------- | ------------- | --------- | --------------------------------------- |
| `FITATU_EMAIL`    | Yes      | none          | Yes       | Fitatu account email address.           |
| `FITATU_PASSWORD` | Yes      | none          | Yes       | Fitatu account password.                |
| `PORT`            | No       | `3000`        | No        | HTTP server port.                       |
| `NODE_ENV`        | No       | `development` | No        | `development`, `production`, or `test`. |
| `SERVER_NAME`     | No       | `fitatu-mcp`  | No        | MCP server name.                        |
| `SERVER_VERSION`  | No       | `2.0.0`       | No        | MCP server version.                     |
| `LOG_LEVEL`       | No       | `info`        | No        | `error`, `warn`, `info`, or `debug`.    |

Do not commit `.env`. The repository keeps `.env.example` as documentation only.

## Local Development

Start the server in watch mode:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Start the built server:

```bash
npm start
```

Run quality checks:

```bash
npm run lint
npm run format:check
npm run test:ci
npm run build
```

`test:ci` runs deterministic unit tests with an informational V8 coverage report and does not load Fitatu credentials. Generate the same text, HTML, and JSON
coverage reports locally with:

```bash
npm run test:coverage
```

The HTML and JSON summary are written to the ignored `coverage/` directory. Run strict TypeScript checks for both production and unit-test code with:

```bash
npm run typecheck
```

Integration tests stay separate:

```bash
npm run test:integration
```

Integration tests require valid Fitatu credentials in `.env` and may read or mutate meal-plan and recipe data in the authenticated account. Recipe workflow
tests create temporary recipes and attempt to remove them during cleanup.

## Docker

Create `.env` before building the image:

```bash
cp .env.example .env
```

Fill in your Fitatu credentials in `.env`.

Build the Docker image:

```bash
docker build -t fitatu-mcp .
```

The build copies `.env` into the image so the server can read it at runtime. Treat the built image as sensitive. Do not push it to a public registry or share it
with other people.

Run the container:

```bash
docker run --name fitatu-mcp -p 3000:3000 fitatu-mcp
```

If a container with that name already exists, recreate it:

```bash
docker stop fitatu-mcp
docker rm fitatu-mcp
docker run --name fitatu-mcp -p 3000:3000 fitatu-mcp
```

## Exposing a Local Server with Cloudflare Tunnel

When the server is running locally on port `3000`, expose it through a temporary Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will print a public tunnel URL. Use that URL with the `/mcp` path as the MCP endpoint.

## Security Notes

- Use this server only with your own Fitatu account.
- Do not commit Fitatu credentials, tokens, cookies, account identifiers, nutrition logs, body measurements, or profile data.
- Do not expose full upstream Fitatu responses in issues, logs, tests, fixtures, or MCP responses.
- Captured HTTP traffic should be used only for legitimate work with your own account and your own network traffic.
- Review mutation tool calls carefully before allowing an MCP client to execute them.
- Treat `remove_meal_items` as destructive and atomic for its selected day-plan UUIDs.
- `delete_recipe` soft-deletes only the catalog definition and leaves existing or historical day-plan snapshots intact.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

This project is licensed under the [MIT License](./LICENSE).
