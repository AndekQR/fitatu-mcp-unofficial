import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./logger.ts";
import { getConfig } from "./config.ts";
import { McpHttpServer } from "./server/McpHttpServer.ts";
import { AddMealItemsTool } from "./tools/addMealItems/AddMealItemsTool.ts";
import { GetCurrentUserTool } from "./tools/currentUser/GetCurrentUserTool.ts";
import { GetDayPlanItemsTool } from "./tools/dayPlanItems/GetDayPlanItemsTool.ts";
import { GetDietSummaryTool } from "./tools/dietSummary/GetDietSummaryTool.ts";
import { MoveMealItemTool } from "./tools/mealItems/MoveMealItemTool.ts";
import { RemoveMealItemsTool } from "./tools/mealItems/RemoveMealItemsTool.ts";
import { UpdateMealItemTool } from "./tools/mealItems/UpdateMealItemTool.ts";
import { SearchFoodTool } from "./tools/searchFood/SearchFoodTool.ts";
import { CreateRecipeTool } from "./tools/recipes/CreateRecipeTool.ts";
import { DeleteRecipeTool } from "./tools/recipes/DeleteRecipeTool.ts";
import { GetRecipeTool } from "./tools/recipes/GetRecipeTool.ts";
import { SearchRecipesTool } from "./tools/recipes/SearchRecipesTool.ts";
import { UpdateRecipeTool } from "./tools/recipes/UpdateRecipeTool.ts";
import { ApplicationServices } from "./services/ApplicationServices.ts";

const applicationServices = new ApplicationServices();

const getServer = (): McpServer => {
	const config = getConfig();
	const server = new McpServer({
		name: config.SERVER_NAME,
		version: config.SERVER_VERSION,
	});

	new GetCurrentUserTool(applicationServices.currentUserService).register(server);
	new GetDayPlanItemsTool(applicationServices.dayPlanQueryService).register(server);
	new GetDietSummaryTool(applicationServices.dietSummaryService).register(server);
	new SearchFoodTool(applicationServices.foodSearchService).register(server);
	new AddMealItemsTool(applicationServices.mealItemMutationService).register(server);
	new UpdateMealItemTool(applicationServices.mealItemMutationService).register(server);
	new RemoveMealItemsTool(applicationServices.mealItemMutationService).register(server);
	new MoveMealItemTool(applicationServices.mealItemMutationService).register(server);
	new CreateRecipeTool(applicationServices.recipeService).register(server);
	new GetRecipeTool(applicationServices.recipeService).register(server);
	new SearchRecipesTool(applicationServices.recipeService).register(server);
	new UpdateRecipeTool(applicationServices.recipeService).register(server);
	new DeleteRecipeTool(applicationServices.recipeService).register(server);

	return server;
};

const httpServer = new McpHttpServer({ createServer: getServer, logger });

async function main() {
	const config = getConfig();
	const listener = httpServer.app.listen(config.PORT, () => {
		logger.info(
			{
				environment: config.NODE_ENV,
				serverName: config.SERVER_NAME,
				version: config.SERVER_VERSION,
			},
			`Fitatu MCP Unofficial server running on port ${config.PORT}`,
		);
	});
	let shuttingDown = false;
	const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		logger.info({ signal }, "Shutting down MCP server");
		await httpServer.closeSessions();
		await new Promise<void>((resolve, reject) => {
			listener.close((error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
		logger.info({ signal }, "MCP server shutdown complete");
	};
	const requestShutdown = (signal: NodeJS.Signals): void => {
		void shutdown(signal).catch((error: unknown) => {
			logger.error(
				{ signal, errorName: error instanceof Error ? error.name : "UnknownError" },
				"MCP server shutdown failed",
			);
			process.exitCode = 1;
		});
	};

	process.on("SIGTERM", () => requestShutdown("SIGTERM"));
	process.on("SIGINT", () => requestShutdown("SIGINT"));
}

main().catch((error) => {
	logger.error(
		{
			error: error instanceof Error ? error.message : error,
		},
		"Server startup error",
	);
	process.exit(1);
});
