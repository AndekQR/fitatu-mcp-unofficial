export interface McpResponseFormatterOptions {
	readonly keepEmptyArrayKeys?: readonly string[];
}

/**
 * Converts MCP success payloads to compact JSON-compatible values.
 *
 * Null values and empty arrays are omitted recursively. Falsy values that
 * convey information, including false and 0, are retained.
 */
export class McpResponseFormatter {
	public format(data: unknown, options: McpResponseFormatterOptions = {}): unknown {
		const jsonValue = this.toJsonValue(data === undefined ? null : data);
		return this.compact(jsonValue, new Set(options.keepEmptyArrayKeys ?? [])) ?? null;
	}

	private toJsonValue(data: unknown): unknown {
		return JSON.parse(JSON.stringify(data));
	}

	private compact(data: unknown, keepEmptyArrayKeys: ReadonlySet<string>, key?: string): unknown {
		if (data === null || data === undefined) {
			return undefined;
		}

		if (Array.isArray(data)) {
			const items = data
				.map((item) => this.compact(item, keepEmptyArrayKeys))
				.filter((item) => item !== undefined);

			return items.length > 0 || (key !== undefined && keepEmptyArrayKeys.has(key)) ? items : undefined;
		}

		if (isRecord(data)) {
			const result: Record<string, unknown> = {};

			for (const [entryKey, value] of Object.entries(data)) {
				const compactValue = this.compact(value, keepEmptyArrayKeys, entryKey);
				if (compactValue !== undefined) {
					result[entryKey] = compactValue;
				}
			}

			return Object.keys(result).length > 0 ? result : undefined;
		}

		return data;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
