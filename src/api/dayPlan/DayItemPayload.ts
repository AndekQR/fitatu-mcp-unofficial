import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import type { CustomMealItemInput } from "./CustomMealItemInput.ts";
import { DayPlanError } from "./DayPlanError.ts";
import { createPlanDayDietItemId } from "./DayPlanItemIdFactory.ts";
import { nowTimestamp } from "./DayPlanTimestamps.ts";
import type { MealItemInput } from "./MealItemInput.ts";
import { MealItemOperationSummary } from "./MealItemOperationSummary.ts";
import type { ProductMealItemInput } from "./ProductMealItemInput.ts";
import type { RecipeMealItemInput } from "./RecipeMealItemInput.ts";

const FITATU_API_SOURCE = "API";

// Fitatu models a one-off custom entry as nutrition for a hidden 100 g measure.
// These upstream-only values make the submitted nutrition equal the entry totals.
const CUSTOM_ITEM_MEASURE_ID = 1;
const CUSTOM_ITEM_MEASURE_QUANTITY = 100;
const CUSTOM_ITEM_MEASURE_WEIGHT_GRAMS = 100;
const CUSTOM_ITEM_MEASURE_CAPACITY = 0;

export class DayItemPayload {
	public readonly payload: Record<string, unknown>;
	public readonly summary: MealItemOperationSummary;

	private constructor(payload: Record<string, unknown>, summary: MealItemOperationSummary) {
		this.payload = payload;
		this.summary = summary;
	}

	public static from(item: MealItemInput, mealKey: string, index: number): DayItemPayload {
		if (item.foodType === "CUSTOM_ITEM") {
			return this.fromCustomItem(item, mealKey, index);
		}
		if (item.foodType === "PRODUCT" || item.foodType === "RECIPE") {
			return this.fromCatalogItem(item, mealKey, index);
		}
		throw new DayPlanError("Unsupported foodType");
	}

	private static fromCatalogItem(
		item: ProductMealItemInput | RecipeMealItemInput,
		mealKey: string,
		index: number,
	): DayItemPayload {
		const isRecipe = item.foodType === "RECIPE";
		const definitionId = isRecipe ? item.recipeId : item.productId;
		const definitionField = isRecipe ? "recipeId" : "productId";
		const normalizedDefinitionId = StringUtils.parseStringOrSafeInteger(
			definitionId,
			`${definitionField} is required`,
		);
		const itemId = createPlanDayDietItemId();
		const payload: Record<string, unknown> = {
			planDayDietItemId: itemId,
			foodType: item.foodType,
			measureId: StringUtils.parseStringOrSafeInteger(item.measureId, "measureId is required"),
			measureQuantity:
				item.measureQuantity === undefined
					? 1
					: NumberUtils.parsePositiveFiniteNumber(item.measureQuantity, "measureQuantity must be > 0"),
			ingredientsServing: isRecipe ? (item.ingredientsServing ?? null) : null,
			source: FITATU_API_SOURCE,
			eaten: item.eaten ?? false,
			updatedAt: nowTimestamp(),
			mealType: mealKey,
		};

		payload[definitionField] = normalizedDefinitionId;
		const productId = isRecipe ? null : definitionId;
		const recipeId = isRecipe ? definitionId : null;

		return new DayItemPayload(
			payload,
			new MealItemOperationSummary(index, itemId, productId, recipeId, item.foodType, mealKey),
		);
	}

	private static fromCustomItem(item: CustomMealItemInput, mealKey: string, index: number): DayItemPayload {
		const itemId = createPlanDayDietItemId();
		const payload: Record<string, unknown> = {
			planDayDietItemId: itemId,
			foodType: "CUSTOM_ITEM",
			name: StringUtils.parseNonEmptyString(item.name, "name is required for CUSTOM_ITEM"),
			energy: parseNonNegativeNutrition(item.energyKcal, "energyKcal"),
			protein: parseNonNegativeNutrition(item.proteinG ?? 0, "proteinG"),
			fat: parseNonNegativeNutrition(item.fatG ?? 0, "fatG"),
			carbohydrate: parseNonNegativeNutrition(item.carbohydrateG ?? 0, "carbohydrateG"),
			measureId: CUSTOM_ITEM_MEASURE_ID,
			measureQuantity: CUSTOM_ITEM_MEASURE_QUANTITY,
			measureWeight: CUSTOM_ITEM_MEASURE_WEIGHT_GRAMS,
			measureCapacity: CUSTOM_ITEM_MEASURE_CAPACITY,
			source: FITATU_API_SOURCE,
			eaten: item.eaten ?? false,
			updatedAt: nowTimestamp(),
			mealType: mealKey,
		};

		return new DayItemPayload(
			payload,
			new MealItemOperationSummary(index, itemId, null, null, "CUSTOM_ITEM", mealKey),
		);
	}
}

function parseNonNegativeNutrition(value: unknown, field: string): number {
	const parsed = NumberUtils.parseFiniteNumber(value, `${field} must be a non-negative finite number`);
	if (parsed < 0) {
		throw new DayPlanError(`${field} must be a non-negative finite number`);
	}
	return parsed;
}
