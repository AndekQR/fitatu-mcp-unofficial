import { z } from "zod";
import type { MealItemInput, MealItemKind } from "../api/dayPlan/MealItemMutation.ts";
import { createToolErrorResult } from "./ToolErrorResult.ts";

const idSchema = z.union([z.string().min(1), z.number().finite()]);
const nullableIdSchema = z.union([z.string(), z.number()]).nullable();

export const mealItemInputSchema = z.object({
	foodId: idSchema.optional(),
	food_id: idSchema.optional(),
	productId: idSchema.optional(),
	product_id: idSchema.optional(),
	recipeId: idSchema.optional(),
	recipe_id: idSchema.optional(),
	foodType: z.string().min(1).optional(),
	food_type: z.string().min(1).optional(),
	measureId: idSchema.optional(),
	measure_id: idSchema.optional(),
	measureQuantity: z.number().positive().optional(),
	measure_quantity: z.number().positive().optional(),
	ingredientsServing: z.number().positive().nullable().optional(),
	ingredients_serving: z.number().positive().nullable().optional(),
	eaten: z.boolean().optional(),
});

export const mealItemMutationOutputSchema = {
	status: z.literal("accepted"),
	operation: z.enum(["add", "update", "remove", "move"]),
	message: z.string(),
	targetDate: z.string(),
	mealKey: z.string().nullable(),
	operationCount: z.number().int(),
	acceptedItems: z.array(
		z.object({
			index: z.number().int(),
			itemId: z.string(),
			productId: nullableIdSchema,
			recipeId: nullableIdSchema,
			foodType: z.string(),
			mealKey: z.string(),
		}),
	),
	createdItemIds: z.array(z.string()),
	updatedItemIds: z.array(z.string()),
	deletedItemIds: z.array(z.string()),
	oldItemId: z.string().nullable(),
	newItemId: z.string().nullable(),
	itemIdChanged: z.boolean(),
};

export const itemKindSchema = z.enum(["auto", "normal_item", "custom_add_item", "custom_recipe_item"]);

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
