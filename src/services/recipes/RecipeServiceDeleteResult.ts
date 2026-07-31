import { RecipeDeleteResult } from "../../api/recipes/RecipeDeleteResult.ts";

export class RecipeServiceDeleteResult extends RecipeDeleteResult {
	public readonly status = "accepted";
	public readonly name: string;
	public readonly deleted = true;

	public constructor(deleted: RecipeDeleteResult, name: string) {
		super(deleted.recipeId);
		this.name = name;
	}
}
