import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface TextResultOptions {
	readonly omitNullsAndEmptyArrays?: boolean;
	readonly keepEmptyArrayKeys?: readonly string[];
}

/**
 * Creates a CallToolResult with text content from any data
 * Handles undefined values gracefully by converting them to null
 * @param data - The data to stringify and include in the result
 * @returns A properly formatted CallToolResult
 */
export function createTextResult(data: unknown, options: TextResultOptions = {}): CallToolResult {
	// Handle undefined gracefully by converting to null
	const safeData = data === undefined ? null : data;
	const plainData = options.omitNullsAndEmptyArrays
		? (omitNullsAndEmptyArrays(toJsonValue(safeData), {
				keepEmptyArrayKeys: new Set(options.keepEmptyArrayKeys ?? []),
			}) ?? null)
		: toJsonValue(safeData);
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

export function createErrorResult(data: unknown): CallToolResult {
	const safeData = data === undefined ? null : data;
	const plainData = toJsonValue(safeData);
	const structuredContent = isRecord(plainData) ? plainData : undefined;

	return {
		isError: true,
		content: [
			{
				type: "text",
				text: typeof plainData === "string" ? plainData : JSON.stringify(plainData, null, 2),
			},
		],
		...(structuredContent ? { structuredContent } : {}),
	};
}

function toJsonValue(data: unknown): unknown {
	if (data === undefined) {
		return null;
	}

	return JSON.parse(JSON.stringify(data));
}

function omitNullsAndEmptyArrays(
	data: unknown,
	options: {
		readonly keepEmptyArrayKeys: ReadonlySet<string>;
	},
	key?: string,
): unknown {
	if (data === null || data === undefined) {
		return undefined;
	}

	if (Array.isArray(data)) {
		const items = data.map((item) => omitNullsAndEmptyArrays(item, options)).filter((item) => item !== undefined);

		return items.length > 0 || (key && options.keepEmptyArrayKeys.has(key)) ? items : undefined;
	}

	if (isRecord(data)) {
		const result: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(data)) {
			const compactValue = omitNullsAndEmptyArrays(value, options, key);
			if (compactValue !== undefined) {
				result[key] = compactValue;
			}
		}

		return Object.keys(result).length > 0 ? result : undefined;
	}

	return data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
