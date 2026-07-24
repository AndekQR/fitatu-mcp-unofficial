import { StringUtils } from "../../shared/StringUtils.ts";
import { DayPlanError } from "./DayPlanError.ts";
import type { MealItemKind } from "./MealItemMutation.ts";

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

export function normalizeFoodType(value: string | undefined, recipeId: string | number | null): string {
	const foodType = value?.trim().toUpperCase();
	if (foodType) {
		return foodType;
	}

	return recipeId ? "RECIPE" : "PRODUCT";
}
