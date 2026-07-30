import type { RecipeDetails } from "./RecipeDetails.ts";

export class RecipeCreateResult<TDetails extends RecipeDetails = RecipeDetails> {
	public readonly recipeId: string;
	public readonly details: TDetails;

	public constructor(recipeId: string, details: TDetails) {
		this.recipeId = recipeId;
		this.details = details;
	}
}
