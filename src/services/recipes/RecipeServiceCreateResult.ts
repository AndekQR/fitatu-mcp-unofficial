import { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";
import type { RecipeServiceDetails } from "./RecipeServiceDetails.ts";

export class RecipeServiceCreateResult {
	public readonly created: RecipeCreateResult;
	public readonly status = "accepted";
	public readonly details: RecipeServiceDetails;
	public readonly warnings: readonly RecipeWarning[];

	public constructor(created: RecipeCreateResult, details: RecipeServiceDetails, warnings: readonly RecipeWarning[]) {
		this.created = created;
		this.details = details;
		this.warnings = warnings;
	}

	public get recipeId(): string {
		return this.created.recipeId;
	}
}
