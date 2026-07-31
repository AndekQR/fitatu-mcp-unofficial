import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FitatuClientOperation } from "../fitatuApiClientBase/FitatuClientOperations.ts";

export const FITATU_MEAL_KEYS = ["breakfast", "second_breakfast", "lunch", "snack", "supper"] as const;
export type FitatuMealKey = (typeof FITATU_MEAL_KEYS)[number];

const FITATU_MEAL_KEY_SET: ReadonlySet<string> = new Set(FITATU_MEAL_KEYS);

export function isFitatuMealKey(value: string): value is FitatuMealKey {
	return FITATU_MEAL_KEY_SET.has(value);
}

export function normalizeMealKey(value: string, operation: FitatuClientOperation): FitatuMealKey {
	try {
		const normalized = StringUtils.parseNonEmptyString(value, "mealKey is required")
			.toLowerCase()
			.replaceAll("-", "_")
			.replaceAll(" ", "_");
		if (!isFitatuMealKey(normalized)) {
			throw FitatuClientError.invalidRequest({
				operation,
				message: `Unknown mealKey "${normalized}". Allowed values: ${FITATU_MEAL_KEYS.join(", ")}`,
			});
		}
		return normalized;
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
