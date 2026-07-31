import { RecipeCreateResult } from "./RecipeCreateResult.ts";

export class RecipeReplaceResult {
	public readonly created: RecipeCreateResult;
	public readonly previousRecipeId: string;
	public readonly identityChanged: boolean;

	public constructor(created: RecipeCreateResult, previousRecipeId: string, identityChanged: boolean) {
		this.created = created;
		this.previousRecipeId = previousRecipeId;
		this.identityChanged = identityChanged;
	}

	public get recipeId(): string {
		return this.created.recipeId;
	}
}
