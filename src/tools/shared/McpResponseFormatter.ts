import { JsonUtils } from "../../shared/JsonUtils.ts";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";

export interface McpResponseFormatterOptions {
	readonly keepEmptyArrayKeys?: readonly string[];
	readonly keepNullKeys?: readonly string[];
}

/**
 * Converts MCP success payloads to compact JSON-compatible values.
 *
 * Null values and empty arrays are omitted recursively. Falsy values that
 * convey information, including false and 0, are retained.
 */
export class McpResponseFormatter {
	public format(data: unknown, options: McpResponseFormatterOptions = {}): unknown {
		const jsonValue = JsonUtils.toJsonValue(data === undefined ? null : data);
		return (
			this.compact(jsonValue, new Set(options.keepEmptyArrayKeys ?? []), new Set(options.keepNullKeys ?? [])) ??
			null
		);
	}

	private compact(
		data: unknown,
		keepEmptyArrayKeys: ReadonlySet<string>,
		keepNullKeys: ReadonlySet<string>,
		key?: string,
	): unknown {
		if (data === null || data === undefined) {
			return data === null && key !== undefined && keepNullKeys.has(key) ? null : undefined;
		}

		if (Array.isArray(data)) {
			const items = data
				.map((item) => this.compact(item, keepEmptyArrayKeys, keepNullKeys))
				.filter((item) => item !== undefined);

			return items.length > 0 || (key !== undefined && keepEmptyArrayKeys.has(key)) ? items : undefined;
		}

		if (ObjectUtils.isRecord(data)) {
			const result: Record<string, unknown> = {};

			for (const [entryKey, value] of Object.entries(data)) {
				const compactValue = this.compact(value, keepEmptyArrayKeys, keepNullKeys, entryKey);
				if (compactValue !== undefined) {
					result[entryKey] = compactValue;
				}
			}

			return Object.keys(result).length > 0 ? result : undefined;
		}

		return data;
	}
}
