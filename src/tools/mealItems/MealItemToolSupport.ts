import { z } from "zod";
import type { MealItemInput, MealItemKind } from "../../services/dayPlan/MealItemTypes.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";

const optionalIdSchema = z.union([z.string(), z.number()]).optional();

export const mealItemInputSchema = z.object({
	foodId: z
		.string()
		.min(1)
		.describe("Fitatu food id returned by search_food. Use this field for both products and recipes."),
	foodType: z
		.string()
		.min(1)
		.optional()
		.describe("Fitatu food type returned by search_food, for example PRODUCT, RECIPE, or CUSTOM_ITEM."),
	measureId: z
		.string()
		.min(1)
		.describe("Measure id to use for this item. Prefer a measureId returned by search_food."),
	measureQuantity: z
		.number()
		.positive()
		.optional()
		.describe("Positive quantity of the selected measure to add, for example 1 for one serving."),
	ingredientsServing: z
		.number()
		.positive()
		.nullable()
		.optional()
		.describe("Optional positive recipe serving multiplier. Use null or omit for ordinary products."),
	eaten: z.boolean().optional().describe("Whether Fitatu should mark the added item as eaten."),
});

export const mealItemMutationOutputSchema = {
	status: z
		.literal("accepted")
		.describe(
			"Mutation request status. Accepted confirms that Fitatu accepted the synchronization request, not that each requested change is present in the persisted day plan.",
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
	acceptedItems: z.array(
		z.object({
			index: z.number().int().describe("Zero-based index of the item in the accepted request."),
			itemId: z.string().describe("Meal item id submitted in the accepted request."),
			productId: optionalIdSchema.describe("Submitted product id, when applicable."),
			recipeId: optionalIdSchema.describe("Submitted recipe id, when applicable."),
			foodType: z.string().describe("Submitted Fitatu food type."),
			mealKey: z.string().describe("Meal key targeted by the submitted item."),
		}),
	),
	createdItemIds: z
		.array(z.string())
		.optional()
		.describe(
			"Client-generated meal item ids submitted for creation in the accepted request. Their persistence is not confirmed by this response.",
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
};

export const itemKindSchema = z
	.enum(["auto", "normal_item", "custom_add_item", "custom_recipe_item"])
	.describe(
		"Fitatu item kind used when removing an item. Use auto unless a previous response identifies a specific kind.",
	);

export function toMealItemInput(input: z.infer<typeof mealItemInputSchema>): MealItemInput {
	return {
		foodId: input.foodId,
		foodType: input.foodType,
		measureId: input.measureId,
		measureQuantity: input.measureQuantity,
		ingredientsServing: input.ingredientsServing,
		eaten: input.eaten,
	};
}

export function toMealItemKind(input: z.infer<typeof itemKindSchema> | undefined): MealItemKind | undefined {
	return input;
}

export function createSafeMealItemErrorResult(toolName: string, fallbackMessage: string, error: unknown) {
	return createToolErrorResult(toolName, fallbackMessage, error);
}
