import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";

/**
 * Default Fitatu meal keys. Accounts can rename meals or configure extra ones
 * (for example "dinner"), so these values are a hint, not a closed enum.
 */
export const FITATU_MEAL_KEYS = ["breakfast", "second_breakfast", "lunch", "snack", "supper"] as const;

export function normalizeMealKey(value: string, operation: FitatuClientOperation): string {
	try {
		return StringUtils.parseNonEmptyString(value, "mealKey is required")
			.toLowerCase()
			.replaceAll("-", "_")
			.replaceAll(" ", "_");
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
