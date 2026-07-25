import { z } from "zod";
import { FITATU_MEAL_KEYS } from "../../api/dayPlan/DayPlanValidators.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import { RecipeIdMapper } from "./RecipeIdMapper.ts";

export const recipeIdInputSchema = z
	.string()
	.regex(RecipeIdMapper.mcpPattern, "recipeId must use recipe:<digits> format")
	.describe("Typed recipe id in recipe:<digits> format returned by a recipe-aware MCP tool.");

export const recipeIngredientInputSchema = z
	.object({
		itemId: z
			.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()])
			.describe(
				"Positive product id for this ingredient. Pass search_food results[].items[].productId here; Fitatu names this field itemId in recipe payloads.",
			),
		measureId: z
			.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()])
			.describe(
				"Positive measure id selected from search_food results[].items[].measureId or measures[].measureId for the chosen product.",
			),
		measureQuantity: z
			.number()
			.positive()
			.finite()
			.describe("Quantity of the selected measure to include. Must be a positive finite number."),
	})
	.strict()
	.describe("Product and measure selection for one recipe ingredient.");

export const recipeTagInputSchema = z
	.object({
		name: z
			.string()
			.trim()
			.min(1)
			.describe(
				"Fitatu tag key. For a custom tag, use its label; when replacing existing tags, copy this value from get_recipe.",
			),
		category: z
			.string()
			.trim()
			.min(1)
			.describe(
				'Fitatu tag category. Use "RECIPE_TAG_USERS_TYPE" for a custom user tag; otherwise copy the exact category returned by get_recipe.',
			),
		translation: z
			.string()
			.trim()
			.min(1)
			.describe(
				"Human-readable tag label. For a custom tag, normally use the same text as name; otherwise copy it from get_recipe.",
			),
	})
	.strict()
	.describe("Complete Fitatu recipe tag.");

const recipeMutableInputSchema = {
	name: z.string().trim().min(1),
	ingredients: z.array(recipeIngredientInputSchema).min(1),
	tags: z.array(recipeTagInputSchema),
	servings: z.number().int().positive(),
	shared: z.boolean(),
	description: z.string().nullable(),
	cookingTimeMinutes: z.number().int().nonnegative().nullable(),
	preparationTimeMinutes: z.number().int().nonnegative().nullable(),
	mealSchema: z.array(
		z.enum(FITATU_MEAL_KEYS, {
			error: `mealSchema entries must be one of: ${FITATU_MEAL_KEYS.join(", ")}`,
		}),
	),
};

export const recipeWriteInputShape = {
	name: recipeMutableInputSchema.name.describe("Non-empty recipe name after trimming."),
	ingredients: recipeMutableInputSchema.ingredients.describe(
		"Products included in the recipe. Provide at least one validated product/measure selection.",
	),
	tags: recipeMutableInputSchema.tags
		.default([])
		.optional()
		.describe("Complete list of system or custom recipe tags. Omit to create the recipe without tags."),
	servings: recipeMutableInputSchema.servings.describe("Positive integer number of portions produced by the recipe."),
	shared: recipeMutableInputSchema.shared
		.default(false)
		.optional()
		.describe("Whether the recipe may be visible in Fitatu's public catalog. Defaults to false (private)."),
	description: recipeMutableInputSchema.description
		.default(null)
		.optional()
		.describe("Preparation instructions. Omit or use null when no instructions are available."),
	cookingTimeMinutes: recipeMutableInputSchema.cookingTimeMinutes
		.default(null)
		.optional()
		.describe("Non-negative whole cooking time in minutes. Omit or use null when unknown."),
	preparationTimeMinutes: recipeMutableInputSchema.preparationTimeMinutes
		.default(null)
		.optional()
		.describe("Non-negative whole preparation time in minutes. Omit or use null when unknown."),
	mealSchema: recipeMutableInputSchema.mealSchema
		.default([])
		.optional()
		.describe(
			`Fitatu meal keys for which the recipe is suggested: ${FITATU_MEAL_KEYS.join(", ")}. Omit for no suggestions.`,
		),
};

export const recipeWriteInputSchema = z.object(recipeWriteInputShape).strict();

const nutritionOutputSchema = z
	.object({
		energyKcal: z.number().optional().describe("Energy per serving in kilocalories, when Fitatu provides it."),
		proteinG: z.number().optional().describe("Protein per serving in grams, when Fitatu provides it."),
		fatG: z.number().optional().describe("Fat per serving in grams, when Fitatu provides it."),
		carbohydrateG: z.number().optional().describe("Carbohydrates per serving in grams, when Fitatu provides them."),
	})
	.describe("Nutrition values calculated for one recipe serving.");

const ingredientOutputSchema = z
	.object({
		itemId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Fitatu item id stored in the recipe."),
		productId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.optional()
			.describe("Underlying Fitatu product id, when the upstream recipe includes it."),
		recipeId: z
			.string()
			.regex(RecipeIdMapper.mcpPattern)
			.optional()
			.describe("Underlying recipe id in recipe:<digits> format; omitted for ordinary product ingredients."),
		name: z.string().optional().describe("Ingredient display name, when Fitatu provides it."),
		type: z
			.literal("PRODUCT")
			.describe("Ingredient kind. Recipe writes currently support PRODUCT ingredients only."),
		measureId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Fitatu measure id used for this ingredient."),
		measureQuantity: z.number().positive().describe("Positive quantity of the selected measure."),
		measureName: z.string().optional().describe("Human-readable measure name, when Fitatu provides it."),
		measureWeightG: z
			.number()
			.nonnegative()
			.optional()
			.describe("Weight of one selected measure in grams, when Fitatu provides it."),
	})
	.describe("Canonical ingredient stored in the recipe.");

const tagOutputSchema = z
	.object({
		name: z.string().describe("Fitatu tag key."),
		category: z.string().describe("Fitatu tag category."),
		translation: z.string().describe("Human-readable tag label."),
	})
	.describe("Recipe tag returned by Fitatu.");

export const recipeWarningOutputSchema = z
	.object({
		code: z.literal("DUPLICATE_INGREDIENT_SELECTION"),
		message: z.string(),
		itemId: z.string().regex(/^[1-9]\d*$/),
		measureId: z.string().regex(/^[1-9]\d*$/),
		indexes: z.array(z.number().int().nonnegative()).min(2),
	})
	.describe("Non-fatal warning about a recipe write request.");

export const recipeDetailsOutputShape = {
	recipeId: z
		.string()
		.regex(RecipeIdMapper.mcpPattern)
		.describe("Canonical typed recipe id in recipe:<digits> format for subsequent MCP operations."),
	userId: z.string().optional().describe("Owning Fitatu user id, when the upstream response exposes it."),
	name: z.string().describe("Recipe display name."),
	servings: z.number().int().positive().describe("Positive integer number of servings produced by the recipe."),
	shared: z.boolean().describe("Whether Fitatu marks the recipe as shared with its public catalog."),
	editable: z.boolean().describe("Whether Fitatu reports that the authenticated user may edit this recipe."),
	deleted: z.boolean().describe("Whether Fitatu reports that the recipe has been deleted."),
	description: z.string().optional().describe("Preparation instructions; omitted when unavailable."),
	cookingTimeMinutes: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Cooking time in whole minutes; omitted when unavailable."),
	preparationTimeMinutes: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.describe("Preparation time in whole minutes; omitted when unavailable."),
	mealSchema: z.array(z.string()).describe("Fitatu meal keys for which the recipe is suggested."),
	tags: z.array(tagOutputSchema).describe("Complete tag list; an empty array means the recipe has no tags."),
	ingredients: z
		.array(ingredientOutputSchema)
		.describe("Canonical ingredient list; an empty array means Fitatu returned no usable ingredients."),
	nutritionPerServing: nutritionOutputSchema,
	weightPerServingG: z
		.number()
		.nonnegative()
		.optional()
		.describe("Calculated weight of one recipe serving in grams, when Fitatu provides it."),
};

export const recipeDetailsOutputSchema = z
	.object(recipeDetailsOutputShape)
	.describe("Canonical Fitatu recipe details. Optional fields are omitted when upstream data is unavailable.");

export const recipeUpdateInputSchema = z
	.object({
		recipeId: recipeIdInputSchema,
		name: recipeMutableInputSchema.name
			.optional()
			.describe("Replacement recipe name. Omit to preserve the current name."),
		ingredients: recipeMutableInputSchema.ingredients
			.optional()
			.describe(
				"Complete replacement ingredient list. Omit to preserve current ingredients; at least one ingredient is required when provided.",
			),
		tags: recipeMutableInputSchema.tags
			.optional()
			.describe("Complete replacement tag list. Omit to preserve current tags; use [] to remove all tags."),
		servings: recipeMutableInputSchema.servings
			.optional()
			.describe("Replacement positive integer serving count. Omit to preserve the current value."),
		shared: recipeMutableInputSchema.shared
			.optional()
			.describe("Replacement sharing setting. Omit to preserve the current value."),
		description: recipeMutableInputSchema.description
			.optional()
			.describe("Replacement preparation instructions. Omit to preserve; use null to clear."),
		cookingTimeMinutes: recipeMutableInputSchema.cookingTimeMinutes
			.optional()
			.describe("Replacement cooking time in whole minutes. Omit to preserve; use null to clear."),
		preparationTimeMinutes: recipeMutableInputSchema.preparationTimeMinutes
			.optional()
			.describe("Replacement preparation time in whole minutes. Omit to preserve; use null to clear."),
		mealSchema: recipeMutableInputSchema.mealSchema
			.optional()
			.describe(
				"Complete replacement list of suggested Fitatu meal keys. Omit to preserve; use [] to remove all suggestions.",
			),
	})
	.strict()
	.refine(
		({ recipeId: _recipeId, ...patch }) => Object.values(patch).some((value) => value !== undefined),
		"At least one recipe field must be provided in addition to recipeId.",
	)
	.describe("Partial recipe update containing recipeId and at least one replacement field.");

export function toRecipeDetailsForMcp(recipe: RecipeDetails): z.infer<typeof recipeDetailsOutputSchema> {
	return {
		recipeId: RecipeIdMapper.toMcp(recipe.recipeId),
		userId: recipe.userId ?? undefined,
		name: recipe.name,
		servings: recipe.servings,
		shared: recipe.shared,
		editable: recipe.editable,
		deleted: recipe.deleted,
		description: recipe.description ?? undefined,
		cookingTimeMinutes: recipe.cookingTimeMinutes ?? undefined,
		preparationTimeMinutes: recipe.preparationTimeMinutes ?? undefined,
		mealSchema: [...recipe.mealSchema],
		tags: recipe.tags.map((tag) => ({ ...tag })),
		ingredients: recipe.ingredients.map((ingredient) => ({
			itemId: ingredient.itemId,
			productId: ingredient.productId ?? undefined,
			recipeId: ingredient.recipeId === null ? undefined : RecipeIdMapper.toMcp(ingredient.recipeId),
			name: ingredient.name ?? undefined,
			type: ingredient.type,
			measureId: ingredient.measureId,
			measureQuantity: ingredient.measureQuantity,
			measureName: ingredient.measureName ?? undefined,
			measureWeightG: ingredient.measureWeightG ?? undefined,
		})),
		nutritionPerServing: {
			energyKcal: recipe.nutritionPerServing.energyKcal ?? undefined,
			proteinG: recipe.nutritionPerServing.proteinG ?? undefined,
			fatG: recipe.nutritionPerServing.fatG ?? undefined,
			carbohydrateG: recipe.nutritionPerServing.carbohydrateG ?? undefined,
		},
		weightPerServingG: recipe.weightPerServingG ?? undefined,
	};
}

export function toRecipeUpdateInput(input: {
	readonly name?: string;
	readonly ingredients?: readonly z.infer<typeof recipeIngredientInputSchema>[];
	readonly tags?: readonly z.infer<typeof recipeTagInputSchema>[];
	readonly servings?: number;
	readonly shared?: boolean;
	readonly description?: string | null;
	readonly cookingTimeMinutes?: number | null;
	readonly preparationTimeMinutes?: number | null;
	readonly mealSchema?: readonly string[];
}): RecipeUpdateInput {
	return Object.fromEntries(
		Object.entries(input)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => [
				key,
				key === "ingredients" && Array.isArray(value)
					? value.map((ingredient) => ({ ...ingredient, type: "PRODUCT" as const }))
					: value,
			]),
	) as RecipeUpdateInput;
}

export const RECIPE_EMPTY_ARRAY_KEYS = ["mealSchema", "tags", "ingredients", "items", "warnings"] as const;
