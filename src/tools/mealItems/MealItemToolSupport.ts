import { z } from "zod";
import type { AddMealItemsResult } from "../../api/dayPlan/AddMealItemsResult.ts";
import { CustomMealItemInput } from "../../api/dayPlan/CustomMealItemInput.ts";
import { FITATU_MEAL_KEYS } from "../../api/dayPlan/DayPlanValidators.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import type { MoveMealItemResult } from "../../api/dayPlan/MoveMealItemResult.ts";
import { ProductMealItemInput } from "../../api/dayPlan/ProductMealItemInput.ts";
import { RecipeMealItemInput } from "../../api/dayPlan/RecipeMealItemInput.ts";
import type { RemoveMealItemsResult } from "../../api/dayPlan/RemoveMealItemsResult.ts";
import type { ReplaceMealItemResult } from "../../api/dayPlan/ReplaceMealItemResult.ts";
import type { UpdateMealItemResult } from "../../api/dayPlan/UpdateMealItemResult.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema, nonEmptyStringSchema, rawRecipeIdSchema } from "../shared/ToolSchemas.ts";

export const MEAL_KEY_HINT = `Typical keys are ${FITATU_MEAL_KEYS.join(", ")}, but accounts with renamed or additional meals may use other keys such as dinner.`;

export const mealKeySchema = z.string().trim().min(1, "mealKey must be a non-empty string");

const catalogMealItemInputShape = {
	measureId: nonEmptyStringSchema("measureId").describe(
		"Measure id to use for this item. Prefer a measureId returned by search_food.",
	),
	measureQuantity: z
		.number()
		.positive()
		.optional()
		.describe("Positive quantity of the selected measure to add, for example 1 for one serving."),
	eaten: z.boolean().optional().describe("Whether Fitatu should mark the added item as eaten."),
};

const productMealItemInputSchema = z
	.object({
		productId: nonEmptyStringSchema("productId").describe("Fitatu product id returned by search_food."),
		...catalogMealItemInputShape,
	})
	.strict()
	.describe(
		"Product item: provide productId and measureId returned by search_food. Do not provide recipeId or custom nutrition fields.",
	);

const recipeMealItemInputSchema = z
	.object({
		recipeId: rawRecipeIdSchema.describe("Raw Fitatu recipe id returned by search_food or a recipe tool."),
		...catalogMealItemInputShape,
	})
	.strict()
	.describe(
		"Recipe item: provide the raw recipeId and measureId returned by search_food or a recipe tool. Do not provide productId or custom nutrition fields.",
	);

const customNutritionSchema = z.number().nonnegative().finite();

const customMealItemInputSchema = z
	.object({
		name: z.string().trim().min(1).describe("Non-empty display name for the custom item."),
		energyKcal: customNutritionSchema.describe("Total energy of the custom item in kilocalories."),
		proteinG: customNutritionSchema.default(0).optional().describe("Total protein in grams. Defaults to 0."),
		fatG: customNutritionSchema.default(0).optional().describe("Total fat in grams. Defaults to 0."),
		carbohydrateG: customNutritionSchema
			.default(0)
			.optional()
			.describe("Total carbohydrates in grams. Defaults to 0."),
		eaten: z.boolean().optional().describe("Whether Fitatu should mark the added item as eaten."),
	})
	.strict()
	.describe(
		"Fallback-only one-off custom item; this is not the preferred way to add food. First search for a suitable product or recipe with search_food or search_recipes and add that catalog item instead. Use this variant only when no suitable catalog match exists, providing name and energyKcal with optional macros. Do not provide productId, recipeId, measureId, or measureQuantity.",
	);

export const mealItemInputSchema = z.union([
	productMealItemInputSchema,
	recipeMealItemInputSchema,
	customMealItemInputSchema,
]);

const confirmedStatusShape = {
	status: z.literal("confirmed").describe("The requested mutation was observed in the persisted Fitatu day plan."),
};

const itemIdSchema = nonEmptyStringSchema("itemId").describe(
	"Persisted meal item id to use in later update, move, replace, or remove operations.",
);

const indexedItemSchema = z
	.object({
		inputIndex: z.number().int().nonnegative().describe("Zero-based index of the corresponding input item."),
		itemId: itemIdSchema,
	})
	.strict();

const removedItemSchema = z
	.object({
		inputIndex: z.number().int().nonnegative().describe("Zero-based index of the corresponding removal target."),
		itemId: nonEmptyStringSchema("itemId").describe("Meal item id confirmed absent from the day plan."),
		mealKey: mealKeySchema.describe("Meal key from which the item was removed."),
	})
	.strict();

export const addMealItemsOutputSchema = {
	...confirmedStatusShape,
	date: isoCalendarDateSchema().describe("Day where the new meal items were confirmed."),
	mealKey: mealKeySchema.describe("Meal containing the confirmed new items."),
	addedItems: z.array(indexedItemSchema).min(1).describe("Confirmed new items in input order."),
};

export const updateMealItemOutputSchema = {
	...confirmedStatusShape,
	date: isoCalendarDateSchema().describe("Day where the updated meal item was confirmed."),
	mealKey: mealKeySchema.describe("Meal containing the confirmed updated item."),
	itemId: itemIdSchema,
};

export const removeMealItemsOutputSchema = {
	...confirmedStatusShape,
	date: isoCalendarDateSchema().describe("Day from which the meal items were removed."),
	removedItems: z.array(removedItemSchema).min(1).describe("Items confirmed absent from the day plan."),
};

export const moveMealItemOutputSchema = {
	...confirmedStatusShape,
	fromDate: isoCalendarDateSchema("fromDate").describe("Previous day of the moved item."),
	fromMealKey: mealKeySchema.describe("Previous meal key of the moved item."),
	previousItemId: nonEmptyStringSchema("previousItemId").describe(
		"Previous item id confirmed absent from the source meal.",
	),
	toDate: isoCalendarDateSchema("toDate").describe("Current day of the moved item."),
	toMealKey: mealKeySchema.describe("Current meal key of the moved item."),
	itemId: itemIdSchema,
};

export const replaceMealItemOutputSchema = {
	...confirmedStatusShape,
	date: isoCalendarDateSchema().describe("Day containing the confirmed replacement item."),
	mealKey: mealKeySchema.describe("Meal containing the confirmed replacement item."),
	previousItemId: nonEmptyStringSchema("previousItemId").describe(
		"Previous item id confirmed absent after replacement.",
	),
	itemId: itemIdSchema,
};

export function toMealItemInput(input: z.infer<typeof mealItemInputSchema>): MealItemInput {
	if ("productId" in input) {
		return new ProductMealItemInput(input.productId, input.measureId, input.measureQuantity, input.eaten);
	}
	if ("recipeId" in input) {
		return new RecipeMealItemInput(input.recipeId, input.measureId, input.measureQuantity, input.eaten);
	}
	return new CustomMealItemInput(
		input.name,
		input.energyKcal,
		input.proteinG ?? 0,
		input.fatG ?? 0,
		input.carbohydrateG ?? 0,
		input.eaten,
	);
}

export function toAddMealItemsForMcp(
	result: AddMealItemsResult,
): z.infer<z.ZodObject<typeof addMealItemsOutputSchema>> {
	return {
		status: "confirmed",
		date: result.date,
		mealKey: result.mealKey,
		addedItems: result.addedItems.map((item) => ({ inputIndex: item.index, itemId: item.itemId })),
	};
}

export function toUpdateMealItemForMcp(
	result: UpdateMealItemResult,
): z.infer<z.ZodObject<typeof updateMealItemOutputSchema>> {
	return {
		status: "confirmed",
		date: result.date,
		mealKey: result.updatedItem.mealKey,
		itemId: result.updatedItem.itemId,
	};
}

export function toRemoveMealItemsForMcp(
	result: RemoveMealItemsResult,
): z.infer<z.ZodObject<typeof removeMealItemsOutputSchema>> {
	return {
		status: "confirmed",
		date: result.date,
		removedItems: result.removedItems.map((item) => ({
			inputIndex: item.index,
			itemId: item.itemId,
			mealKey: item.mealKey,
		})),
	};
}

export function toMoveMealItemForMcp(
	result: MoveMealItemResult,
): z.infer<z.ZodObject<typeof moveMealItemOutputSchema>> {
	return {
		status: "confirmed",
		fromDate: result.fromDate,
		fromMealKey: result.fromMealKey,
		previousItemId: result.previousItemId,
		toDate: result.toDate,
		toMealKey: result.movedItem.mealKey,
		itemId: result.movedItem.itemId,
	};
}

export function toReplaceMealItemForMcp(
	result: ReplaceMealItemResult,
): z.infer<z.ZodObject<typeof replaceMealItemOutputSchema>> {
	return {
		status: "confirmed",
		date: result.date,
		mealKey: result.mealKey,
		previousItemId: result.previousItemId,
		itemId: result.replacementItem.itemId,
	};
}

export function createSafeMealItemErrorResult(toolName: string, fallbackMessage: string, error: unknown) {
	return ToolErrorResult.create(toolName, fallbackMessage, error);
}
