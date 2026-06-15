import { DayPlanError } from "./DayPlanError.ts";
import type { MealItemKind } from "./MealItemMutation.ts";

export function normalizeDate(value: string): string {
	const date = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		throw new DayPlanError("date must use YYYY-MM-DD format");
	}

	const parsed = new Date(`${date}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
		throw new DayPlanError("date must be a valid calendar date");
	}

	return date;
}

export function normalizeUserId(value: string | undefined): string {
	const userId = value?.trim() ?? "";
	if (!userId) {
		throw new DayPlanError("Fitatu user id is required");
	}

	return userId;
}

export function normalizeMealKey(value: string): string {
	const normalized = normalizeRequiredText(value, "mealKey").toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
	return normalized === "second_breakfast" ? "second_breakfast" : normalized;
}

export function normalizeRequiredText(value: string, fieldName: string): string {
	const text = value.trim();
	if (!text) {
		throw new DayPlanError(`${fieldName} is required`);
	}

	return text;
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

export function normalizeId(value: string | number, fieldName: string): string | number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim()) {
		const trimmed = value.trim();
		const numeric = Number(trimmed);
		return Number.isSafeInteger(numeric) && String(numeric) === trimmed ? numeric : trimmed;
	}

	throw new DayPlanError(`${fieldName} is required`);
}

export function normalizePositiveNumber(value: number, fieldName: string): number {
	if (!Number.isFinite(value) || value <= 0) {
		throw new DayPlanError(`${fieldName} must be > 0`);
	}

	return value;
}
