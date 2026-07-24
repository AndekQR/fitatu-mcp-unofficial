import { RecipeCreateResult } from "./RecipeCreateResult.ts";

export class RecipeReplaceResult extends RecipeCreateResult {
	declare public readonly previousRecipeId: string;
	declare public readonly identityChanged: boolean;
}
