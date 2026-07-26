import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import type { RecipeCreateResult } from "../../api/recipes/RecipeCreateResult.ts";
import type { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";
import type { RecipeReplaceResult } from "../../api/recipes/RecipeReplaceResult.ts";
import type { RecipeWarning } from "./RecipeWarning.ts";

interface RecipeWarningsResult {
	readonly warnings: readonly RecipeWarning[];
}

export type RecipeServiceDetails = RecipeDetails & {
	readonly measures: readonly FoodMeasure[];
};

export type RecipeServiceCreateResult = Omit<RecipeCreateResult, "details"> &
	RecipeWarningsResult & {
		readonly details: RecipeServiceDetails;
	};

export type RecipeServiceReplaceResult = Omit<RecipeReplaceResult, "details"> &
	RecipeWarningsResult & {
		readonly details: RecipeServiceDetails;
	};
