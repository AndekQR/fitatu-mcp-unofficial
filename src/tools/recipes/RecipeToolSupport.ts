import { z } from "zod";
import { FITATU_MEAL_KEYS } from "../../api/dayPlan/DayPlanValidators.ts";
import type { RecipeUpdateInput } from "../../api/recipes/RecipeUpdateInput.ts";
import type { RecipeServiceDetails } from "../../services/recipes/RecipeServiceResult.ts";
import type { RecipeWarning } from "../../services/recipes/RecipeWarning.ts";
import { rawRecipeIdSchema } from "../shared/ToolSchemas.ts";

export const recipeIdInputSchema = rawRecipeIdSchema.describe(
	"Raw Fitatu recipe id returned by a recipe-aware MCP tool.",
);

export const recipeIngredientInputSchema = z
	.object({
		productId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Positive product id for this ingredient. Pass search_food results[].items[].productId here."),
		measureId: z
			.string()
			.regex(/^[1-9]\d*$/)
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
				"Fitatu tag key. For a custom tag, use its label; when replacing existing tags, copy this value from get_recipe. Fitatu may normalize custom tag text to lowercase; compare returned custom tags case-insensitively.",
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
				"Human-readable tag label. For a custom tag, normally use the same text as name; otherwise copy it from get_recipe. Fitatu may normalize custom tag text to lowercase; compare returned custom tags case-insensitively.",
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
	steps: z.array(
		z
			.string()
			.trim()
			.min(1)
			.refine((step) => !/[\r\n]/.test(step), "Each recipe step must be a single line."),
	),
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
	steps: recipeMutableInputSchema.steps
		.default([])
		.optional()
		.describe(
			"Ordered preparation steps without numeric prefixes. Put exactly one step in each string; Fitatu displays every array item as a separate step field. Omit or use [] when no instructions are available.",
		),
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
			`Fitatu meal keys for which the recipe is suggested: ${FITATU_MEAL_KEYS.join(", ")}. Omit for no suggestions. Use only this declared enum; raw public catalog values returned by get_recipe may not be valid mutation inputs.`,
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

const recipeMeasureOutputSchema = z
	.object({
		measureId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Measure id to pass with this recipeId to add_meal_items."),
		measureName: z.string().optional().describe("Human-readable measure name returned by Fitatu."),
		weightG: z
			.number()
			.nonnegative()
			.optional()
			.describe("Weight represented by one unit of this measure, in grams."),
		unit: z.string().optional().describe("Fitatu unit key for this measure, when available."),
		energyKcal: z
			.number()
			.nonnegative()
			.optional()
			.describe("Energy represented by one unit of this measure, in kilocalories."),
	})
	.describe("A Fitatu measure accepted for this recipe by add_meal_items.");

const ingredientOutputSchema = z
	.object({
		productId: z
			.string()
			.regex(/^[1-9]\d*$/)
			.describe("Fitatu product id stored in the recipe."),
		recipeId: rawRecipeIdSchema
			.optional()
			.describe("Underlying raw recipe id; omitted for ordinary product ingredients."),
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
		productId: z.string().regex(/^[1-9]\d*$/),
		measureId: z.string().regex(/^[1-9]\d*$/),
		indexes: z.array(z.number().int().nonnegative()).min(2),
	})
	.describe("Non-fatal warning about a recipe write request.");

export const recipeDetailsOutputShape = {
	recipeId: rawRecipeIdSchema.describe("Canonical raw Fitatu recipe id for subsequent MCP operations."),
	userId: z.string().optional().describe("Owning Fitatu user id, when the upstream response exposes it."),
	name: z.string().describe("Recipe display name."),
	servings: z.number().int().positive().describe("Positive integer number of servings produced by the recipe."),
	shared: z.boolean().describe("Whether Fitatu marks the recipe as shared with its public catalog."),
	editable: z
		.boolean()
		.describe(
			"True only when this recipe is active and the authenticated user may currently update or delete it. Deleted and unowned recipes are false.",
		),
	deleted: z.boolean().describe("Whether Fitatu reports that the recipe has been deleted."),
	steps: z
		.array(z.string())
		.describe(
			"Ordered preparation steps parsed from Fitatu's newline-delimited recipe description; an empty array means no instructions are available.",
		),
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
	mealSchema: z
		.array(z.string())
		.describe(
			"Raw Fitatu meal keys stored with the recipe. Public catalog values such as dinner are preserved and are not the accepted input enum for recipe mutations.",
		),
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
	measures: z
		.array(recipeMeasureOutputSchema)
		.describe(
			"Measures accepted for this recipe by add_meal_items. Copy recipeId with one listed measureId; an empty array means Fitatu returned no usable measures.",
		),
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
		steps: recipeMutableInputSchema.steps
			.optional()
			.describe(
				"Complete replacement preparation steps without numeric prefixes. Put one step in each string; omit to preserve the current steps and use [] to clear them.",
			),
		cookingTimeMinutes: recipeMutableInputSchema.cookingTimeMinutes
			.optional()
			.describe("Replacement cooking time in whole minutes. Omit to preserve; use null to clear."),
		preparationTimeMinutes: recipeMutableInputSchema.preparationTimeMinutes
			.optional()
			.describe("Replacement preparation time in whole minutes. Omit to preserve; use null to clear."),
		mealSchema: recipeMutableInputSchema.mealSchema
			.optional()
			.describe(
				"Complete replacement list of suggested Fitatu meal keys using only this declared enum. Omit to preserve the stored value, including raw public catalog values; use [] to remove all suggestions.",
			),
	})
	.strict()
	.refine(
		({ recipeId: _recipeId, ...patch }) => Object.values(patch).some((value) => value !== undefined),
		"At least one recipe field must be provided in addition to recipeId.",
	)
	.describe("Partial recipe update containing recipeId and at least one replacement field.");

export function toRecipeDetailsForMcp(recipe: RecipeServiceDetails): z.infer<typeof recipeDetailsOutputSchema> {
	return {
		recipeId: recipe.recipeId,
		userId: recipe.userId ?? undefined,
		name: recipe.name,
		servings: recipe.servings,
		shared: recipe.shared,
		editable: recipe.editable,
		deleted: recipe.deleted,
		steps: toRecipeSteps(recipe.description),
		cookingTimeMinutes: recipe.cookingTimeMinutes ?? undefined,
		preparationTimeMinutes: recipe.preparationTimeMinutes ?? undefined,
		mealSchema: [...recipe.mealSchema],
		tags: recipe.tags.map((tag) => ({ ...tag })),
		ingredients: recipe.ingredients.map((ingredient) => ({
			productId: ingredient.productId ?? ingredient.itemId,
			recipeId: ingredient.recipeId ?? undefined,
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
		measures: recipe.measures.flatMap((measure) => {
			if (measure.measureId === null || !/^[1-9]\d*$/.test(measure.measureId)) {
				return [];
			}
			return [
				{
					measureId: measure.measureId,
					measureName: measure.measureName ?? undefined,
					weightG: measure.weightG ?? undefined,
					unit: measure.unit ?? undefined,
					energyKcal: measure.energyKcal ?? undefined,
				},
			];
		}),
	};
}

export function toRecipeUpdateInput(input: {
	readonly name?: string;
	readonly ingredients?: readonly z.infer<typeof recipeIngredientInputSchema>[];
	readonly tags?: readonly z.infer<typeof recipeTagInputSchema>[];
	readonly servings?: number;
	readonly shared?: boolean;
	readonly steps?: readonly string[];
	readonly cookingTimeMinutes?: number | null;
	readonly preparationTimeMinutes?: number | null;
	readonly mealSchema?: readonly string[];
}): RecipeUpdateInput {
	return Object.fromEntries(
		Object.entries(input)
			.filter(([, value]) => value !== undefined)
			.map(([key, value]) => [
				key === "steps" ? "description" : key,
				key === "steps" && Array.isArray(value)
					? toRecipeDescription(value)
					: key === "ingredients" && Array.isArray(value)
						? value.map(({ productId, ...ingredient }) => ({
								...ingredient,
								itemId: productId,
								type: "PRODUCT" as const,
							}))
						: value,
			]),
	) as RecipeUpdateInput;
}

export function toRecipeDescription(steps: readonly string[]): string | null {
	if (steps.length === 0) {
		return null;
	}
	return steps.map((step, index) => `${index + 1}. ${stripRecipeStepNumber(step.trim())}`).join("\n");
}

function toRecipeSteps(description: string | null): string[] {
	if (description === null) {
		return [];
	}
	return description
		.split(/\r?\n/)
		.map((step) => stripRecipeStepNumber(step.trim()))
		.filter(Boolean);
}

function stripRecipeStepNumber(step: string): string {
	return step.replace(/^\d+[.)]\s+/, "");
}

export function toRecipeWarningsForMcp(
	warnings: readonly RecipeWarning[],
): readonly z.infer<typeof recipeWarningOutputSchema>[] {
	return warnings.map(({ itemId, indexes, ...warning }) => ({
		...warning,
		productId: itemId,
		indexes: [...indexes],
	}));
}

export const RECIPE_EMPTY_ARRAY_KEYS = [
	"steps",
	"mealSchema",
	"tags",
	"ingredients",
	"measures",
	"items",
	"warnings",
] as const;
