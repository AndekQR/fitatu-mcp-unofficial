import { RecipeSearchItem } from "../../api/recipes/RecipeSearchItem.ts";
import type { RecipeServiceDetails } from "./RecipeServiceDetails.ts";

export class DetailedRecipeSearchItem extends RecipeSearchItem {
	public readonly details: RecipeServiceDetails;

	public constructor(summary: RecipeSearchItem, details: RecipeServiceDetails) {
		super(summary.recipeId, summary.name, summary.source, summary.energyKcal);
		this.details = details;
	}
}
