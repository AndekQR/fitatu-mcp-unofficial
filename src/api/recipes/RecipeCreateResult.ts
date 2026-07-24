import type { RecipeDetails } from "./RecipeDetails.ts";

export class RecipeCreateResult {
	declare public readonly recipeId: string;
	declare public readonly details: RecipeDetails;
}
