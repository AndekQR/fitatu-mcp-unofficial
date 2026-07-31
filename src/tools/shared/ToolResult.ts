import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { JsonUtils } from "../../shared/JsonUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { McpResponseFormatter, type McpResponseFormatterOptions } from "./McpResponseFormatter.ts";

const responseFormatter = new McpResponseFormatter();

/** Creates an MCP success result from data that is safe to return to the caller. */
export function createTextResult(data: unknown, options: McpResponseFormatterOptions = {}): CallToolResult {
	const plainData = responseFormatter.format(data, options);
	const structuredContent = ObjectUtils.isRecord(plainData) ? plainData : undefined;

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(plainData, null, 2),
			},
		],
		...(structuredContent ? { structuredContent } : {}),
	};
}

/** Creates an MCP error result without compacting diagnostic fields. */
export function createErrorResult(data: unknown): CallToolResult {
	const plainData = JsonUtils.toJsonValue(data === undefined ? null : data);

	return {
		isError: true,
		content: [
			{
				type: "text",
				text: typeof plainData === "string" ? plainData : JSON.stringify(plainData, null, 2),
			},
		],
	};
}
