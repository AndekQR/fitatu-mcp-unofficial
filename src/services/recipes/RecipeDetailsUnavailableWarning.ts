import { RecipeSearchWarning } from "../../api/recipes/RecipeSearchWarning.ts";

export class RecipeDetailsUnavailableWarning extends RecipeSearchWarning {
	public readonly recipeId: string;

	public constructor(warning: RecipeSearchWarning, recipeId: string) {
		if (warning.code !== "RECIPE_DETAILS_UNAVAILABLE") {
			throw new Error("Recipe details warning must use the RECIPE_DETAILS_UNAVAILABLE code");
		}
		super(warning.code, warning.source, warning.message, warning.clientError);
		this.recipeId = recipeId;
	}
}
