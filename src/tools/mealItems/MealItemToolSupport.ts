import { z } from "zod";
import type { MealItemMutationResult } from "../../api/dayPlan/MealItemMutationResult.ts";
import type { MealItemInput, MealItemKind } from "../../services/dayPlan/MealItemTypes.ts";
import { RecipeIdMapper } from "../recipes/RecipeIdMapper.ts";
import { createToolErrorResult } from "../shared/ToolErrorResult.ts";

const optionalIdSchema = z.union([z.string(), z.number()]).optional();

export const mealItemInputSchema = z
	.object({
		foodId: z
			.string()
			.min(1)
			.describe(
				"Fitatu food id returned by search_food. Recipe values must use recipe:<digits>; product and custom-item values remain unprefixed.",
			),
		foodType: z
			.enum(["PRODUCT", "RECIPE", "CUSTOM_ITEM"])
			.describe("Required Fitatu food type copied from search_food."),
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
	})
	.strict()
	.superRefine((item, context) => {
		if (item.foodType === "RECIPE" && !RecipeIdMapper.mcpPattern.test(item.foodId)) {
			context.addIssue({
				code: "custom",
				path: ["foodId"],
				message: "RECIPE foodId must use recipe:<digits> format",
			});
		}
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
			recipeId: z
				.string()
				.regex(RecipeIdMapper.mcpPattern)
				.optional()
				.describe("Submitted recipe id in recipe:<digits> format, when applicable."),
			foodType: z.enum(["PRODUCT", "RECIPE", "CUSTOM_ITEM"]).describe("Submitted Fitatu food type."),
			mealKey: z.string().describe("Meal key targeted by the submitted item."),
		}),
	),
	provisionalItemIds: z
		.array(z.string())
		.optional()
		.describe(
			"Client-generated item ids submitted for creation. They remain provisional until get_day_plan_items confirms persistence.",
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
		foodId: input.foodType === "RECIPE" ? RecipeIdMapper.fromMcp(input.foodId) : input.foodId,
		foodType: input.foodType,
		measureId: input.measureId,
		measureQuantity: input.measureQuantity,
		ingredientsServing: input.ingredientsServing,
		eaten: input.eaten,
	};
}

export function toMealItemMutationForMcp(result: MealItemMutationResult) {
	return {
		...result,
		acceptedItems: result.acceptedItems.map((item) => ({
			...item,
			productId: item.productId ?? undefined,
			recipeId: item.recipeId === null ? undefined : RecipeIdMapper.toMcp(item.recipeId),
		})),
	};
}

export function toMealItemKind(input: z.infer<typeof itemKindSchema> | undefined): MealItemKind | undefined {
	return input;
}

export function createSafeMealItemErrorResult(toolName: string, fallbackMessage: string, error: unknown) {
	return createToolErrorResult(toolName, fallbackMessage, error);
}
