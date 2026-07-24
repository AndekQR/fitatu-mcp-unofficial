import type { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeReplaceResult } from "../../api/recipes/RecipeReplaceResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";

interface RecipeWarningsResult {
	readonly warnings: readonly RecipeWarning[];
}

export type RecipeServiceCreateResult = RecipeCreateResult & RecipeWarningsResult;
export type RecipeServiceReplaceResult = RecipeReplaceResult & RecipeWarningsResult;
