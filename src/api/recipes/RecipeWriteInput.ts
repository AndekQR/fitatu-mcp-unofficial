import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { ValidationError } from "../../shared/ValidationError.ts";
import type { RecipeIngredientInput } from "./RecipeIngredientInput.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeWriteInput {
	public readonly name: string;
	public readonly ingredients: readonly RecipeIngredientInput[];
	public readonly tags: readonly RecipeTag[];
	public readonly servings: number;
	public readonly shared: boolean;
	public readonly description: string | null;
	public readonly cookingTimeMinutes: number | null;
	public readonly preparationTimeMinutes: number | null;
	public readonly mealSchema: readonly string[];

	public constructor(
		name: string,
		ingredients: readonly RecipeIngredientInput[],
		tags: readonly RecipeTag[],
		servings: number,
		shared: boolean,
		description: string | null,
		cookingTimeMinutes: number | null,
		preparationTimeMinutes: number | null,
		mealSchema: readonly string[],
	) {
		this.name = name;
		this.ingredients = ingredients;
		this.tags = tags;
		this.servings = servings;
		this.shared = shared;
		this.description = description;
		this.cookingTimeMinutes = cookingTimeMinutes;
		this.preparationTimeMinutes = preparationTimeMinutes;
		this.mealSchema = mealSchema;
	}

	public static toRecipePayload(input: RecipeWriteInput, categories: unknown): Record<string, unknown> {
		if (input.ingredients.length === 0) {
			throw new ValidationError("ingredients must not be empty");
		}
		const name = StringUtils.parseNonEmptyString(input.name, "name is required");
		const servings = NumberUtils.parsePositiveInteger(input.servings, "servings must be a positive integer");

		return {
			name,
			items: input.ingredients.map((ingredient) => ({
				itemId: StringUtils.parseStringOrSafeInteger(ingredient.itemId, "ingredient itemId is required"),
				measureId: StringUtils.parseStringOrSafeInteger(
					ingredient.measureId,
					"ingredient measureId is required",
				),
				measureQuantity: NumberUtils.parsePositiveFiniteNumber(
					ingredient.measureQuantity,
					"ingredient measureQuantity must be greater than zero",
				),
				type: ingredient.type,
			})),
			tags: input.tags.map((tag) => ({
				name: StringUtils.parseNonEmptyString(tag.name, "tag name is required"),
				category: StringUtils.parseNonEmptyString(tag.category, "tag category is required"),
				translation: StringUtils.parseNonEmptyString(tag.translation, "tag translation is required"),
			})),
			serving: String(servings),
			shared: input.shared,
			recipeDescription: input.description,
			cookingTime:
				input.cookingTimeMinutes === null
					? null
					: NumberUtils.parseNonNegativeInteger(
							input.cookingTimeMinutes,
							"cookingTimeMinutes must be null or a non-negative integer",
						),
			preparationTime:
				input.preparationTimeMinutes === null
					? null
					: NumberUtils.parseNonNegativeInteger(
							input.preparationTimeMinutes,
							"preparationTimeMinutes must be null or a non-negative integer",
						),
			mealSchema: input.mealSchema.map((meal) =>
				StringUtils.parseNonEmptyString(meal, "mealSchema item is required"),
			),
			categories,
		};
	}
}
