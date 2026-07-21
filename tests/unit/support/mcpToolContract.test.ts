import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTextResult } from "../../../src/tools/shared/ToolResult.ts";
import { getTextContent, registerToolForTest } from "./mcpToolTestDouble.ts";

describe("MCP tool contract harness", () => {
	it("rejects successful structured content that violates the registered output schema", async () => {
		const registered = await registerToolForTest({
			register(server: McpServer): void {
				server.registerTool(
					"broken_output",
					{
						description: "Deliberately broken tool used to verify SDK output validation.",
						inputSchema: {},
						outputSchema: { value: z.string() },
					},
					async () => createTextResult({ wrongField: true }),
				);
			},
		});

		expect(registered.config.outputSchema).toMatchObject({ type: "object", required: ["value"] });
		const result = await registered.invoke({});

		expect(result.isError).toBe(true);
		expect(getTextContent(result)).toContain("Output validation error");
	});
});
