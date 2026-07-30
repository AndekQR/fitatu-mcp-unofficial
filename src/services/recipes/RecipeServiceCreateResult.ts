import { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";
import type { RecipeServiceDetails } from "./RecipeServiceDetails.ts";

export class RecipeServiceCreateResult extends RecipeCreateResult<RecipeServiceDetails> {
	public override readonly details: RecipeServiceDetails;
	public readonly warnings: readonly RecipeWarning[];

	public constructor(created: RecipeCreateResult<RecipeServiceDetails>, warnings: readonly RecipeWarning[]) {
		super(created.recipeId, created.details);
		this.details = created.details;
		this.warnings = warnings;
	}
}
