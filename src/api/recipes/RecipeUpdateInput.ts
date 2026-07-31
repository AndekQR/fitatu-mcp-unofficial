import type { RecipeIngredientInput } from "./RecipeIngredientInput.ts";
import type { RecipeTag } from "./RecipeTag.ts";

export class RecipeUpdateInput {
	public readonly name?: string;
	public readonly ingredients?: readonly RecipeIngredientInput[];
	public readonly tags?: readonly RecipeTag[];
	public readonly servings?: number;
	public readonly shared?: boolean;
	public readonly description?: string | null;
	public readonly cookingTimeMinutes?: number | null;
	public readonly preparationTimeMinutes?: number | null;
	public readonly mealSchema?: readonly string[];

	public constructor(
		name?: string,
		ingredients?: readonly RecipeIngredientInput[],
		tags?: readonly RecipeTag[],
		servings?: number,
		shared?: boolean,
		description?: string | null,
		cookingTimeMinutes?: number | null,
		preparationTimeMinutes?: number | null,
		mealSchema?: readonly string[],
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
}
