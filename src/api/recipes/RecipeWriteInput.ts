import { NumberUtils } from "../../shared/NumberUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { RecipeError } from "./RecipeError.ts";
import type { RecipeIngredientInput } from "./RecipeIngredientInput.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeWriteInput {
	declare public readonly name: string;
	declare public readonly ingredients: readonly RecipeIngredientInput[];
	declare public readonly tags: readonly RecipeTag[];
	declare public readonly servings: number;
	declare public readonly shared: boolean;
	declare public readonly description: string | null;
	declare public readonly cookingTimeMinutes: number | null;
	declare public readonly preparationTimeMinutes: number | null;
	declare public readonly mealSchema: readonly string[];

	public static toRecipePayload(input: RecipeWriteInput, categories: unknown): Record<string, unknown> {
		if (input.ingredients.length === 0) {
			throw new RecipeError("ingredients must not be empty");
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
