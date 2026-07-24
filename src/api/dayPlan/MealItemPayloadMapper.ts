import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { DayPlanError } from "./DayPlanError.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import type { MealItemInput, MealItemOperationSummary } from "./MealItemMutation.ts";
import { normalizeFoodType } from "./DayPlanValidators.ts";

export interface DayItemPayload {
	readonly payload: Record<string, unknown>;
	readonly summary: MealItemOperationSummary;
}

export function toDayItemPayload(item: MealItemInput, mealKey: string, index: number): DayItemPayload {
	const suppliedProductId = item.productId ?? item.foodId ?? null;
	const foodType = normalizeFoodType(item.foodType, item.recipeId ?? null);
	const isRecipe = foodType === "RECIPE";
	const recipeId = item.recipeId ?? (isRecipe ? suppliedProductId : null);
	const productId = isRecipe ? null : suppliedProductId;

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
		measureId: StringUtils.parseStringOrSafeInteger(item.measureId, "measureId is required"),
		measureQuantity:
			item.measureQuantity === undefined
				? 1
				: NumberUtils.parsePositiveFiniteNumber(item.measureQuantity, "measureQuantity must be > 0"),
		ingredientsServing: item.ingredientsServing ?? null,
		source: "API",
		eaten: item.eaten ?? false,
		updatedAt: nowTimestamp(),
		mealType: mealKey,
	};

	if (recipeId) {
		payload.recipeId = StringUtils.parseStringOrSafeInteger(recipeId, "recipeId is required");
	} else if (productId) {
		payload.productId = StringUtils.parseStringOrSafeInteger(productId, "productId is required");
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
