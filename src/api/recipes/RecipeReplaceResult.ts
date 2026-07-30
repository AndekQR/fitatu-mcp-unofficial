import { RecipeCreateResult } from "./RecipeCreateResult.ts";
import type { RecipeDetails } from "./RecipeDetails.ts";

export class RecipeReplaceResult<TDetails extends RecipeDetails = RecipeDetails> extends RecipeCreateResult<TDetails> {
	public readonly previousRecipeId: string;
	public readonly identityChanged: boolean;

	public constructor(created: RecipeCreateResult<TDetails>, previousRecipeId: string, identityChanged: boolean) {
		super(created.recipeId, created.details);
		this.previousRecipeId = previousRecipeId;
		this.identityChanged = identityChanged;
	}
}
