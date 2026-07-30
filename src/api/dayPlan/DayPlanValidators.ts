import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";

export const FITATU_MEAL_KEYS = ["breakfast", "second_breakfast", "lunch", "snack", "supper"] as const;

export function normalizeMealKey(value: string, operation: FitatuClientOperation): string {
	try {
		const normalized = StringUtils.parseNonEmptyString(value, "mealKey is required")
			.toLowerCase()
			.replaceAll("-", "_")
			.replaceAll(" ", "_");
		return normalized === "second_breakfast" ? "second_breakfast" : normalized;
	} catch (error) {
		if (!(error instanceof ValidationError)) {
			throw error;
		}
		throw FitatuClientError.invalidRequest({
			operation,
			message: error.message,
		});
	}
}
