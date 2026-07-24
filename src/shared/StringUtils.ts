export class StringUtils {
	public static stringOrNull(value: unknown): string | null {
		if (typeof value === "string") {
			return value.trim() || null;
		}

		if (typeof value === "number" && Number.isFinite(value)) {
			return String(value);
		}

		return null;
	}

	public static parseString(value: unknown, errorMessage = "Value must be a string"): string {
		if (typeof value !== "string") {
			throw new Error(errorMessage);
		}

		return value;
	}

	public static parseStringValue(
		value: unknown,
		errorMessage = "Value must be a non-empty string or finite number",
	): string {
		const parsed = StringUtils.stringOrNull(value);
		if (parsed === null) {
			throw new Error(errorMessage);
		}

		return parsed;
	}

	public static parseStringOrSafeInteger(
		value: unknown,
		errorMessage = "Value must be a non-empty string or finite number",
	): string | number {
		const parsed = StringUtils.parseStringValue(value, errorMessage);
		const numeric = Number(parsed);
		return Number.isSafeInteger(numeric) && String(numeric) === parsed ? numeric : parsed;
	}

	public static parseNonEmptyString(value: null | undefined, errorMessage?: string): never;
	public static parseNonEmptyString(value: unknown, errorMessage?: string): string;
	public static parseNonEmptyString(value: unknown, errorMessage = "Value must be a non-empty string"): string {
		const normalized = StringUtils.parseString(value, errorMessage).trim();
		if (!normalized) {
			throw new Error(errorMessage);
		}

		return normalized;
	}

	public static firstNonEmptyString(...values: readonly unknown[]): string | undefined {
		for (const value of values) {
			if (typeof value === "string") {
				const normalized = value.trim();
				if (normalized) {
					return normalized;
				}
			}
		}

		return undefined;
	}

	public static parseFirstNonEmptyString(
		values: readonly unknown[],
		errorMessage = "At least one value must be a non-empty string",
	): string {
		const parsed = StringUtils.firstNonEmptyString(...values);
		if (parsed === undefined) {
			throw new Error(errorMessage);
		}

		return parsed;
	}

	public static parseOptionalFirstNonEmptyString(
		values: readonly unknown[],
		errorMessage = "Provided value must be a non-empty string",
	): string | undefined {
		return values.every((value) => value === null || value === undefined)
			? undefined
			: StringUtils.parseFirstNonEmptyString(values, errorMessage);
	}
}
