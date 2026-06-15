import { DayPlanError } from "./DayPlanError.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import type { MealItemInput, MealItemOperationSummary } from "./MealItemMutation.ts";
import { normalizeFoodType, normalizeId, normalizePositiveNumber } from "./DayPlanValidators.ts";

export interface DayItemPayload {
	readonly payload: Record<string, unknown>;
	readonly summary: MealItemOperationSummary;
}

export function toDayItemPayload(item: MealItemInput, mealKey: string, index: number): DayItemPayload {
	const productId = item.productId ?? item.foodId ?? null;
	const recipeId = item.recipeId ?? null;
	const foodType = normalizeFoodType(item.foodType, recipeId);

	if (!productId && !recipeId) {
		throw new DayPlanError("foodId, productId, or recipeId is required");
	}
	if (item.measureId === undefined) {
		throw new DayPlanError("measureId is required");
	}

	const itemId = createPlanDayDietItemId();
	const payload: Record<string, unknown> = {
		planDayDietItemId: itemId,
		foodType,
		measureId: normalizeId(item.measureId, "measureId"),
		measureQuantity:
			item.measureQuantity === undefined ? 1 : normalizePositiveNumber(item.measureQuantity, "measureQuantity"),
		ingredientsServing: item.ingredientsServing ?? null,
		source: "API",
		eaten: item.eaten ?? false,
		updatedAt: nowTimestamp(),
		mealType: mealKey,
	};

	if (recipeId) {
		payload.recipeId = normalizeId(recipeId, "recipeId");
	} else if (productId) {
		payload.productId = normalizeId(productId, "productId");
	}

	return {
		payload,
		summary: {
			index,
			itemId,
			productId,
			recipeId,
			foodType,
			mealKey,
		},
	};
}
