import { RecipeWriteInput } from "./RecipeWriteInput.ts";
import type { RecipeIngredientInput } from "./RecipeIngredientInput.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeReplacementInput extends RecipeWriteInput {
	public readonly categories: unknown;

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
		categories: unknown,
	) {
		super(
			name,
			ingredients,
			tags,
			servings,
			shared,
			description,
			cookingTimeMinutes,
			preparationTimeMinutes,
			mealSchema,
		);
		this.categories = categories;
	}
}
