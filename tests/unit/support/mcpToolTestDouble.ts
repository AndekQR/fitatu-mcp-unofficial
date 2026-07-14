import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

interface ToolForTest {
	register(server: McpServer): void;
}

interface ToolConfigForTest {
	readonly inputSchema: Record<string, z.ZodType>;
	readonly annotations?: Record<string, unknown>;
}

export interface RegisteredToolForTest {
	readonly name: string;
	readonly config: ToolConfigForTest;
	invoke(input: unknown): Promise<CallToolResult>;
}

export function registerToolForTest(tool: ToolForTest): RegisteredToolForTest {
	let registration:
		| {
				readonly name: string;
				readonly config: ToolConfigForTest;
				readonly handler: (input: unknown) => Promise<CallToolResult>;
		  }
		| undefined;

	const server = {
		registerTool: (name: string, config: unknown, handler: unknown) => {
			if (!isToolConfig(config) || typeof handler !== "function") {
				throw new Error(`Tool ${name} registered an invalid test contract`);
			}

			registration = {
				name,
				config,
				handler: handler as (input: unknown) => Promise<CallToolResult>,
			};
		},
	} as unknown as McpServer;

	tool.register(server);

	if (!registration) {
		throw new Error("Tool did not register a handler");
	}

	const { name, config, handler } = registration;
	const inputSchema = z.object(config.inputSchema);

	return {
		name,
		config,
		invoke: async (input) => handler(inputSchema.parse(input)),
	};
}

export function parseTextContent(result: CallToolResult): unknown {
	const content = result.content[0];
	if (content?.type !== "text") {
		throw new Error("Expected the first MCP content item to contain text");
	}

	return JSON.parse(content.text);
}

function isToolConfig(value: unknown): value is ToolConfigForTest {
	return typeof value === "object" && value !== null && "inputSchema" in value;
}
