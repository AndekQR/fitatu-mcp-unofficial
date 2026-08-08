import { z } from "zod";
import { CustomMealItemInput } from "../../api/dayPlan/CustomMealItemInput.ts";
import { FITATU_MEAL_KEYS } from "../../api/dayPlan/DayPlanValidators.ts";
import type { MealItemInput } from "../../api/dayPlan/MealItemInput.ts";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import { ProductMealItemInput } from "../../api/dayPlan/ProductMealItemInput.ts";
import { RecipeMealItemInput } from "../../api/dayPlan/RecipeMealItemInput.ts";
import { ToolErrorResult } from "../shared/ToolErrorResult.ts";
import { isoCalendarDateSchema, rawRecipeIdSchema } from "../shared/ToolSchemas.ts";

export const MEAL_KEY_HINT = `Typical keys are ${FITATU_MEAL_KEYS.join(", ")}, but accounts with renamed or additional meals may use other keys such as dinner.`;

export const mealKeySchema = z.string().trim().min(1, "mealKey must be a non-empty string");

const catalogMealItemInputShape = {
	measureId: z
		.string()
		.min(1)
		.describe("Measure id to use for this item. Prefer a measureId returned by search_food."),
	measureQuantity: z
		.number()
		.positive()
		.optional()
		.describe("Positive quantity of the selected measure to add, for example 1 for one serving."),
	eaten: z.boolean().optional().describe("Whether Fitatu should mark the added item as eaten."),
};

const productMealItemInputSchema = z
	.object({
		productId: z.string().min(1).describe("Fitatu product id returned by search_food."),
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

const acceptedItemBaseShape = {
	index: z.number().int().describe("Zero-based index of the item in the accepted request."),
	itemId: z.string().describe("Meal item id submitted in the accepted request."),
	mealKey: z.string().describe("Meal key targeted by the submitted item."),
};

const acceptedItemOutputSchema = z.union([
	z
		.object({
			...acceptedItemBaseShape,
			productId: z.string().describe("Submitted raw Fitatu product id."),
		})
		.strict(),
	z
		.object({
			...acceptedItemBaseShape,
			recipeId: rawRecipeIdSchema.describe("Submitted raw Fitatu recipe id."),
		})
		.strict(),
	z
		.object({
			...acceptedItemBaseShape,
		})
		.strict(),
]);

const mealItemMutationOutputObjectSchema = z.object({
	status: z
		.literal("accepted")
		.describe(
			"Fitatu accepted the synchronization request and the service confirmed every requested change in the persisted day plan.",
		),
	operation: z.enum(["add", "update", "remove", "move"]).describe("Meal item mutation operation that was requested."),
	message: z.string().describe("Human-readable summary of the mutation result."),
	targetDate: z
		.string()
		.describe(
			"Primary YYYY-MM-DD date for the mutation. For move operations, this is the source date; inspect acceptedItems for the destination meal.",
		),
	mealKey: z
		.string()
		.optional()
		.describe(
			"Primary Fitatu meal key for the mutation, when applicable. For move operations, this is the source meal key; inspect acceptedItems for the destination meal.",
		),
	operationCount: z
		.number()
		.int()
		.describe("Number of meal items submitted in the synchronization request accepted by Fitatu."),
	dayRevisions: z
		.record(isoCalendarDateSchema(), z.string().min(1))
		.describe(
			"Fitatu synchronization revisions keyed by YYYY-MM-DD date. Empty only for a legacy endpoint response without receipts.",
		),
	acceptedItems: z.array(acceptedItemOutputSchema),
	provisionalItemIds: z
		.array(z.string())
		.optional()
		.describe(
			"Client-generated item ids submitted for creation and confirmed by the service in the persisted day plan.",
		),
	updatedItemIds: z
		.array(z.string())
		.optional()
		.describe("Meal item ids updated by the accepted mutation, when any."),
	deletedItemIds: z
		.array(z.string())
		.optional()
		.describe("Meal item ids deleted by the accepted mutation, when any."),
	oldItemId: z.string().optional().describe("Original item id when an operation replaced or moved an item."),
	newItemId: z.string().optional().describe("New item id when Fitatu returned a replacement id."),
	itemIdChanged: z.boolean().describe("Whether Fitatu changed the item id as part of the operation."),
});

export const mealItemMutationOutputSchema = mealItemMutationOutputObjectSchema.shape;
export type MealItemMutationForMcp = z.infer<typeof mealItemMutationOutputObjectSchema>;

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

export function toMealItemMutationForMcp(result: MealItemMutationResult): MealItemMutationForMcp {
	return {
		status: result.status,
		operation: result.operation,
		message: result.message,
		targetDate: result.targetDate,
		mealKey: result.mealKey ?? undefined,
		operationCount: result.operationCount,
		dayRevisions: result.dayRevisions.toRecord(),
		acceptedItems: result.acceptedItems.map((item) => {
			if (item.foodType === "CUSTOM_ITEM") {
				return {
					index: item.index,
					itemId: item.itemId,
					mealKey: item.mealKey,
				};
			}
			return item.foodType === "RECIPE"
				? {
						index: item.index,
						itemId: item.itemId,
						recipeId: requireDefinitionId(item.recipeId, "recipeId"),
						mealKey: item.mealKey,
					}
				: {
						index: item.index,
						itemId: item.itemId,
						productId: requireDefinitionId(item.productId, "productId"),
						mealKey: item.mealKey,
					};
		}),
		provisionalItemIds: [...result.provisionalItemIds],
		updatedItemIds: [...result.updatedItemIds],
		deletedItemIds: [...result.deletedItemIds],
		oldItemId: result.oldItemId ?? undefined,
		newItemId: result.newItemId ?? undefined,
		itemIdChanged: result.itemIdChanged,
	};
}

function requireDefinitionId(value: string | number | null, fieldName: string): string {
	if (value === null) {
		throw new Error(`${fieldName} is required for accepted meal item`);
	}
	return String(value);
}

export function createSafeMealItemErrorResult(toolName: string, fallbackMessage: string, error: unknown) {
	return ToolErrorResult.create(toolName, fallbackMessage, error);
}
