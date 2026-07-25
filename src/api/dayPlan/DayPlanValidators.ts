import { StringUtils } from "../../shared/StringUtils.ts";
import { DayPlanError } from "./DayPlanError.ts";
import type { MealItemKind } from "./RemoveMealItemOptions.ts";

export const FITATU_MEAL_KEYS = ["breakfast", "second_breakfast", "lunch", "snack", "supper"] as const;

export function normalizeMealKey(value: string): string {
	const normalized = StringUtils.parseNonEmptyString(value, "mealKey is required")
		.toLowerCase()
		.replaceAll("-", "_")
		.replaceAll(" ", "_");
	return normalized === "second_breakfast" ? "second_breakfast" : normalized;
}

export function normalizeItemKind(value: MealItemKind): MealItemKind {
	if (["auto", "normal_item", "custom_add_item", "custom_recipe_item"].includes(value)) {
		return value;
	}

	throw new DayPlanError("itemKind must be one of: auto, normal_item, custom_add_item, custom_recipe_item");
}
