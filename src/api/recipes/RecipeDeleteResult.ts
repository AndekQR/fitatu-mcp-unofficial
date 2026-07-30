export class RecipeDeleteResult {
	public readonly recipeId: string;
	public readonly deleted = true;

	public constructor(recipeId: string) {
		this.recipeId = recipeId;
	}
}
