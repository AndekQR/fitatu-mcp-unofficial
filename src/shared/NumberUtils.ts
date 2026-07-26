import { ValidationError } from "./ValidationError.ts";

export class NumberUtils {
	public static parseOptionalFiniteNumber(
		value: unknown,
		errorMessage = "Value must be a finite number",
	): number | null {
		return value === null || value === undefined || value === ""
			? null
			: NumberUtils.parseFiniteNumber(value, errorMessage);
	}

	public static parseFiniteNumber(value: unknown, errorMessage = "Value must be a finite number"): number {
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}

		if (typeof value === "string" && value.trim()) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}

		throw new ValidationError(errorMessage);
	}

	public static parseInteger(value: unknown, errorMessage = "Value must be an integer"): number {
		const parsed = NumberUtils.parseFiniteNumber(value, errorMessage);
		if (!Number.isInteger(parsed)) {
			throw new ValidationError(errorMessage);
		}

		return parsed;
	}

	public static parsePositiveInteger(value: unknown, errorMessage = "Value must be a positive integer"): number {
		const parsed = NumberUtils.parseInteger(value, errorMessage);
		if (parsed <= 0) {
			throw new ValidationError(errorMessage);
		}

		return parsed;
	}

	public static parseNonNegativeInteger(
		value: unknown,
		errorMessage = "Value must be a non-negative integer",
	): number {
		const parsed = NumberUtils.parseInteger(value, errorMessage);
		if (parsed < 0) {
			throw new ValidationError(errorMessage);
		}

		return parsed;
	}

	public static parseIntegerInRange(
		value: unknown,
		minimum: number,
		maximum: number,
		errorMessage = `Value must be between ${minimum} and ${maximum}`,
	): number {
		const parsed = NumberUtils.parseInteger(value, errorMessage);
		if (parsed < minimum || parsed > maximum) {
			throw new ValidationError(errorMessage);
		}

		return parsed;
	}

	public static parsePositiveFiniteNumber(
		value: unknown,
		errorMessage = "Value must be a positive finite number",
	): number {
		const parsed = NumberUtils.parseFiniteNumber(value, errorMessage);
		if (parsed <= 0) {
			throw new ValidationError(errorMessage);
		}

		return parsed;
	}
}
