import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Creates a CallToolResult with text content from any data
 * Handles undefined values gracefully by converting them to null
 * @param data - The data to stringify and include in the result
 * @returns A properly formatted CallToolResult
 */
export function createTextResult(data: unknown): CallToolResult {
	// Handle undefined gracefully by converting to null
	const safeData = data === undefined ? null : data;
	const plainData = toJsonValue(safeData);
	const structuredContent = isRecord(plainData) ? plainData : undefined;

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

export function createErrorResult(message: string): CallToolResult {
	return {
		isError: true,
		content: [
			{
				type: "text",
				text: message,
			},
		],
	};
}

function toJsonValue(data: unknown): unknown {
	if (data === undefined) {
		return null;
	}

	return JSON.parse(JSON.stringify(data));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
