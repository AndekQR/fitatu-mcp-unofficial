import { RecipeReplaceResult } from "../../api/recipes/RecipeReplaceResult.ts";
import { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";
import type { RecipeServiceDetails } from "./RecipeServiceDetails.ts";

export class RecipeServiceReplaceResult extends RecipeReplaceResult<RecipeServiceDetails> {
	public override readonly details: RecipeServiceDetails;
	public readonly warnings: readonly RecipeWarning[];

	public constructor(
		replaced: RecipeReplaceResult,
		details: RecipeServiceDetails,
		warnings: readonly RecipeWarning[],
	) {
		super(new RecipeCreateResult(replaced.recipeId, details), replaced.previousRecipeId, replaced.identityChanged);
		this.details = details;
		this.warnings = warnings;
	}
}
