import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolResultSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ToolForTest {
	register(server: McpServer): void;
}

type ListedTool = Awaited<ReturnType<Client["listTools"]>>["tools"][number];

export interface RegisteredToolForTest {
	readonly name: string;
	readonly config: ListedTool;
	invoke(input: Record<string, unknown>): Promise<CallToolResult>;
}

export async function registerToolForTest(tool: ToolForTest): Promise<RegisteredToolForTest> {
	const server = new McpServer({ name: "fitatu-unit-test-server", version: "1.0.0" });
	const client = new Client({ name: "fitatu-unit-test-client", version: "1.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

	tool.register(server);
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

	const tools = await client.listTools();
	const registeredTool = tools.tools[0];
	if (!registeredTool || tools.tools.length !== 1) {
		await closePair(client, server);
		throw new Error(`Expected exactly one registered tool, received ${tools.tools.length}`);
	}
	if (!registeredTool.description || !registeredTool.outputSchema) {
		await closePair(client, server);
		throw new Error(`Tool ${registeredTool.name} must publish a description and output schema`);
	}

	return {
		name: registeredTool.name,
		config: registeredTool,
		invoke: async (input) => {
			try {
				const result = await client.callTool({ name: registeredTool.name, arguments: input });
				return CallToolResultSchema.parse(result);
			} finally {
				await closePair(client, server);
			}
		},
	};
}

export function getTextContent(result: CallToolResult): string {
	const content = result.content[0];
	if (content?.type !== "text") {
		throw new Error("Expected the first MCP content item to contain text");
	}

	return content.text;
}

export function parseTextContent(result: CallToolResult): unknown {
	return JSON.parse(getTextContent(result));
}

async function closePair(client: Client, server: McpServer): Promise<void> {
	await Promise.allSettled([client.close(), server.close()]);
}
