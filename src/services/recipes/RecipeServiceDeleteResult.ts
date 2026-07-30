import { RecipeDeleteResult } from "../../api/recipes/RecipeDeleteResult.ts";

export class RecipeServiceDeleteResult extends RecipeDeleteResult {
	public readonly name: string;

	public constructor(deleted: RecipeDeleteResult, name: string) {
		super(deleted.recipeId);
		this.name = name;
	}
}
