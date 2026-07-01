import { asRecord, isRecord } from "./DayPlanApiResponse.ts";
import type { MealItemKind, MealItemOperationSummary } from "./MealItemMutation.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";

export interface FoundDietItem {
	readonly mealKey: string;
	readonly item: Record<string, unknown>;
	readonly items: Record<string, unknown>[];
	readonly index: number;
}

export function getMealItems(dietPlan: Record<string, unknown>, mealKey: string): Record<string, unknown>[] {
	const meal = asRecord(dietPlan[mealKey], `meal ${mealKey}`);
	const items = meal.items;
	if (Array.isArray(items)) {
		const normalizedItems = items.filter(isRecord);
		meal.items = normalizedItems;
		return normalizedItems;
	}

	const normalizedItems: Record<string, unknown>[] = [];
	meal.items = normalizedItems;
	return normalizedItems;
}

export function findItemInDietPlan(
	dietPlan: Record<string, unknown>,
	mealKey: string,
	itemId: string,
	anyMeal: boolean,
): FoundDietItem | null {
	const primary = findItemInMeal(dietPlan, mealKey, itemId);
	if (primary || !anyMeal) {
		return primary;
	}

	for (const key of Object.keys(dietPlan)) {
		if (key === mealKey) {
			continue;
		}

		const found = findItemInMeal(dietPlan, key, itemId);
		if (found) {
			return found;
		}
	}

	return null;
}

export function findActiveProductItemsInDietPlan(
	dietPlan: Record<string, unknown>,
	productIds: ReadonlySet<string>,
): readonly FoundDietItem[] {
	const found: FoundDietItem[] = [];

	for (const key of Object.keys(dietPlan)) {
		const meal = dietPlan[key];
		if (!isRecord(meal)) {
			continue;
		}

		const items = getMealItems(dietPlan, key);
		items.forEach((item, index) => {
			const productId = item.productId;
			const foodType = String(item.foodType ?? "")
				.trim()
				.toUpperCase();
			const deletedAt = typeof item.deletedAt === "string" ? item.deletedAt.trim() : "";

			if (deletedAt || foodType !== "PRODUCT" || !productIds.has(String(productId ?? ""))) {
				return;
			}

			found.push({
				mealKey: key,
				item,
				items,
				index,
			});
		});
	}

	return found;
}

export function resolveItemKind(item: Record<string, unknown>): Exclude<MealItemKind, "auto"> {
	const foodType = String(item.foodType ?? "")
		.trim()
		.toUpperCase();
	const source = String(item.source ?? "")
		.trim()
		.toUpperCase();
	const hasProductId = item.productId !== null && item.productId !== undefined;
	const quantity =
		typeof item.measureQuantity === "number" ? item.measureQuantity : Number(item.measureQuantity ?? 0);

	if (foodType === "PRODUCT" || hasProductId) {
		return "normal_item";
	}
	if (foodType === "CUSTOM_ITEM") {
		return source === "API" && Number.isFinite(quantity) && quantity <= 2
			? "custom_recipe_item"
			: "custom_add_item";
	}

	return "normal_item";
}

export function createDeletedItemMarker(item: Record<string, unknown>): Record<string, unknown> {
	const marker: Record<string, unknown> = {
		planDayDietItemId: item.planDayDietItemId,
		foodType: item.foodType ?? "CUSTOM_ITEM",
		measureId: item.measureId ?? 1,
		measureQuantity: item.measureQuantity ?? 1,
		source: item.source ?? "API",
		deletedAt: nowTimestamp(),
		updatedAt: nowTimestamp(),
	};
	const foodType = String(marker.foodType ?? "")
		.trim()
		.toUpperCase();

	if (foodType === "CUSTOM_ITEM") {
		marker.name = item.name ?? "x";
		marker.energy = item.energy ?? 0;
		marker.protein = item.protein ?? 0;
		marker.fat = item.fat ?? 0;
		marker.carbohydrate = item.carbohydrate ?? 0;
	} else if (item.productId !== undefined && item.productId !== null) {
		marker.productId = item.productId;
	}

	if (item.recipeId !== undefined && item.recipeId !== null) {
		marker.recipeId = item.recipeId;
	}

	return marker;
}

export function toOperationSummary(input: {
	readonly index: number;
	readonly item: Record<string, unknown>;
	readonly itemId: string;
	readonly mealKey: string;
}): MealItemOperationSummary {
	return {
		index: input.index,
		itemId: input.itemId,
		productId: optionalId(input.item.productId),
		recipeId: optionalId(input.item.recipeId),
		foodType: typeof input.item.foodType === "string" ? input.item.foodType : "UNKNOWN",
		mealKey: input.mealKey,
	};
}

function findItemInMeal(dietPlan: Record<string, unknown>, mealKey: string, itemId: string): FoundDietItem | null {
	const meal = dietPlan[mealKey];
	if (!isRecord(meal)) {
		return null;
	}

	const items = getMealItems(dietPlan, mealKey);
	const index = items.findIndex((item) => {
		const planItemId = item.planDayDietItemId;
		const productId = item.productId;
		return String(planItemId ?? "") === itemId || String(productId ?? "") === itemId;
	});

	if (index < 0) {
		return null;
	}

	const item = items[index];
	if (!item) {
		return null;
	}

	return {
		mealKey,
		item,
		items,
		index,
	};
}

function optionalId(value: unknown): string | number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}

	return null;
}
