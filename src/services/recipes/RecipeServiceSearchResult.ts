import type { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import type { RecipeSearchItem } from "../../api/recipes/RecipeSearchItem.ts";
import type { RecipeSearchResult, RecipeSearchWarning } from "../../api/recipes/RecipeSearchResult.ts";
import type { RecipeSearchSource } from "../../api/recipes/RecipeSearchSource.ts";
import type { RecipeServiceDetails } from "./RecipeServiceResult.ts";

export type RecipeServiceSearchItem = RecipeSearchItem & Partial<RecipeServiceDetails>;

export type RecipeDetailsUnavailableWarning = {
	readonly code: "RECIPE_DETAILS_UNAVAILABLE";
	readonly source: RecipeSearchSource;
	readonly recipeId: string;
	readonly message: string;
	readonly clientError: FitatuClientError;
};

export type RecipeServiceSearchWarning = RecipeSearchWarning | RecipeDetailsUnavailableWarning;

export type RecipeServiceSearchResult = Omit<RecipeSearchResult, "items" | "warnings"> & {
	readonly items: readonly RecipeServiceSearchItem[];
	readonly warnings: readonly RecipeServiceSearchWarning[];
};
