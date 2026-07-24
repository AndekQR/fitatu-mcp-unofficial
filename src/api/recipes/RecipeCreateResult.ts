import type { RecipeDetails } from "./RecipeDetails.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";

export class RecipeCreateResult {
	declare public readonly recipeId: string;
	declare public readonly details: RecipeDetails;
	declare public readonly warnings: readonly RecipeWarning[];
}
