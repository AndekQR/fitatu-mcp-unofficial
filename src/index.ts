import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./logger.ts";
import { getConfig } from "./config.ts";
import { AddMealItemsTool } from "./tools/AddMealItemsTool.ts";
import { GetCurrentUserTool } from "./tools/GetCurrentUserTool.ts";
import { GetDayPlanItemsTool } from "./tools/GetDayPlanItemsTool.ts";
import { MoveMealItemTool } from "./tools/MoveMealItemTool.ts";
import { RemoveMealItemTool } from "./tools/RemoveMealItemTool.ts";
import { SearchFoodTool } from "./tools/SearchFoodTool.ts";
import { UpdateMealItemTool } from "./tools/UpdateMealItemTool.ts";

const getServer = () => {
	const config = getConfig();
	const server = new McpServer({
		name: config.SERVER_NAME,
		version: config.SERVER_VERSION,
	});

	new GetCurrentUserTool().register(server);
	new GetDayPlanItemsTool().register(server);
	new SearchFoodTool().register(server);
	new AddMealItemsTool().register(server);
	new UpdateMealItemTool().register(server);
	new RemoveMealItemTool().register(server);
	new MoveMealItemTool().register(server);

	return server;
};

const app = express();
app.use(express.json());

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

const mcpHandler = async (req: express.Request, res: express.Response) => {
	const sessionId = req.headers["mcp-session-id"] as string | undefined;

	try {
		// Handle initialization requests (usually POST without session ID)
		if (req.method === "POST" && !sessionId && isInitializeRequest(req.body)) {
			logger.info("Initializing new MCP session");

			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: () => randomUUID(),
				onsessioninitialized: (sessionId) => {
					transports[sessionId] = transport;
					logger.info({ sessionId }, "MCP session initialized");
				},
			});

			const server = getServer();
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
			return;
		}

		// Handle existing session requests
		if (sessionId && transports[sessionId]) {
			const transport = transports[sessionId];
			await transport.handleRequest(req, res, req.body);
			return;
		}

		// Handle case where no session ID is provided for non-init requests
		if (req.method === "POST" && !sessionId) {
			logger.warn("POST request without session ID for non-initialization request");
			res.status(400).json({
				error: "Session ID required for non-initialization requests",
			});
			return;
		}

		// Handle unknown session
		if (sessionId && !transports[sessionId]) {
			logger.warn({ sessionId }, "Request for unknown session");
			res.status(404).json({ error: "Session not found" });
			return;
		}

		// For GET requests without session, return server info
		if (req.method === "GET") {
			const config = getConfig();
			res.json({
				name: config.SERVER_NAME,
				version: config.SERVER_VERSION,
				description: "TypeScript template for building MCP servers",
				capabilities: ["tools"],
			});
		}
	} catch (error) {
		logger.error(
			{
				error: error instanceof Error ? error.message : error,
			},
			"Error handling MCP request",
		);
		res.status(500).json({ error: "Internal server error" });
	}
};

// Handle MCP requests on /mcp endpoint
app.post("/mcp", mcpHandler);
app.get("/mcp", mcpHandler);

async function main() {
	const config = getConfig();

	// Graceful shutdown handling
	process.on("SIGTERM", () => {
		logger.info("SIGTERM received, shutting down gracefully");
		process.exit(0);
	});

	process.on("SIGINT", () => {
		logger.info("SIGINT received, shutting down gracefully");
		process.exit(0);
	});

	app.listen(config.PORT, () => {
		logger.info(
			{
				environment: config.NODE_ENV,
				serverName: config.SERVER_NAME,
				version: config.SERVER_VERSION,
			},
			`MCP TypeScript Template Server running on port ${config.PORT}`,
		);
	});
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
