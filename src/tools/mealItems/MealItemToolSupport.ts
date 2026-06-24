import { z } from "zod";
import type { MealItemInput, MealItemKind } from "../../services/dayPlan/MealItemTypes.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";

const idSchema = z.union([z.string().min(1), z.number().finite()]);
const optionalIdSchema = z.union([z.string(), z.number()]).optional();

export const mealItemInputSchema = z.object({
	foodId: idSchema
		.optional()
		.describe("Fitatu food id returned by search_food. Provide foodId or productId for product items."),
	food_id: idSchema
		.optional()
		.describe("Snake_case alias for foodId. Prefer foodId unless the caller already uses snake_case."),
	productId: idSchema
		.optional()
		.describe("Fitatu product id returned by search_food. This is usually the same value as foodId."),
	product_id: idSchema
		.optional()
		.describe("Snake_case alias for productId. Prefer productId unless the caller already uses snake_case."),
	recipeId: idSchema.optional().describe("Fitatu recipe id when adding a recipe instead of a product."),
	recipe_id: idSchema
		.optional()
		.describe("Snake_case alias for recipeId. Prefer recipeId unless the caller already uses snake_case."),
	foodType: z
		.string()
		.min(1)
		.optional()
		.describe("Fitatu food type returned by search_food, for example PRODUCT or CUSTOM_ITEM."),
	food_type: z
		.string()
		.min(1)
		.optional()
		.describe("Snake_case alias for foodType. Prefer foodType unless the caller already uses snake_case."),
	measureId: idSchema
		.optional()
		.describe("Measure id to use for this item. Prefer a measureId returned by search_food."),
	measure_id: idSchema
		.optional()
		.describe("Snake_case alias for measureId. Prefer measureId unless the caller already uses snake_case."),
	measureQuantity: z
		.number()
		.positive()
		.optional()
		.describe("Positive quantity of the selected measure to add, for example 1 for one serving."),
	measure_quantity: z
		.number()
		.positive()
		.optional()
		.describe(
			"Snake_case alias for measureQuantity. Prefer measureQuantity unless the caller already uses snake_case.",
		),
	ingredientsServing: z
		.number()
		.positive()
		.nullable()
		.optional()
		.describe("Optional positive recipe serving multiplier. Use null or omit for ordinary products."),
	ingredients_serving: z
		.number()
		.positive()
		.nullable()
		.optional()
		.describe(
			"Snake_case alias for ingredientsServing. Prefer ingredientsServing unless the caller already uses snake_case.",
		),
	eaten: z.boolean().optional().describe("Whether Fitatu should mark the added item as eaten."),
});

export const mealItemMutationOutputSchema = {
	status: z
		.literal("accepted")
		.describe("Mutation request status. Accepted means Fitatu accepted the asynchronous change."),
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
	operationCount: z.number().int().describe("Number of meal items included in the accepted mutation."),
	acceptedItems: z.array(
		z.object({
			index: z.number().int().describe("Zero-based index of the accepted item in the request."),
			itemId: z.string().describe("Fitatu meal item id accepted by the mutation."),
			productId: optionalIdSchema.describe("Product id for the accepted product item, when applicable."),
			recipeId: optionalIdSchema.describe("Recipe id for the accepted recipe item, when applicable."),
			foodType: z.string().describe("Fitatu food type for the accepted item."),
			mealKey: z.string().describe("Meal key containing the accepted item."),
		}),
	),
	createdItemIds: z.array(z.string()).optional().describe("Meal item ids created by the accepted mutation, when any."),
	updatedItemIds: z.array(z.string()).optional().describe("Meal item ids updated by the accepted mutation, when any."),
	deletedItemIds: z.array(z.string()).optional().describe("Meal item ids deleted by the accepted mutation, when any."),
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
		foodId: input.foodId ?? input.food_id,
		productId: input.productId ?? input.product_id,
		recipeId: input.recipeId ?? input.recipe_id,
		foodType: input.foodType ?? input.food_type,
		measureId: input.measureId ?? input.measure_id,
		measureQuantity: input.measureQuantity ?? input.measure_quantity,
		ingredientsServing: input.ingredientsServing ?? input.ingredients_serving,
		eaten: input.eaten,
	};
}

export function toMealItemKind(input: z.infer<typeof itemKindSchema> | undefined): MealItemKind | undefined {
	return input;
}

export function createSafeMealItemErrorResult(toolName: string, fallbackMessage: string, error: unknown) {
	return createToolErrorResult(toolName, fallbackMessage, error);
}
