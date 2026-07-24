import type { RecipeIngredientInput } from "./RecipeIngredientInput.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeUpdateInput {
	declare public readonly name?: string;
	declare public readonly ingredients?: readonly RecipeIngredientInput[];
	declare public readonly tags?: readonly RecipeTag[];
	declare public readonly servings?: number;
	declare public readonly shared?: boolean;
	declare public readonly description?: string | null;
	declare public readonly cookingTimeMinutes?: number | null;
	declare public readonly preparationTimeMinutes?: number | null;
	declare public readonly mealSchema?: readonly string[];
}
