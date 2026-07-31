import { RecipeReplaceResult } from "../../api/recipes/RecipeReplaceResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";
import type { RecipeServiceDetails } from "./RecipeServiceDetails.ts";

export class RecipeServiceReplaceResult {
	public readonly replaced: RecipeReplaceResult;
	public readonly status = "accepted";
	public readonly details: RecipeServiceDetails;
	public readonly warnings: readonly RecipeWarning[];

	public constructor(
		replaced: RecipeReplaceResult,
		details: RecipeServiceDetails,
		warnings: readonly RecipeWarning[],
	) {
		this.replaced = replaced;
		this.details = details;
		this.warnings = warnings;
	}

	public get recipeId(): string {
		return this.replaced.recipeId;
	}

	public get previousRecipeId(): string {
		return this.replaced.previousRecipeId;
	}

	public get identityChanged(): boolean {
		return this.replaced.identityChanged;
	}
}
