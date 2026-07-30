import type { FoodMeasure } from "../../api/foodSearch/FoodMeasure.ts";
import { RecipeDetails } from "../../api/recipes/RecipeDetails.ts";

export class RecipeServiceDetails extends RecipeDetails {
	public readonly measures: readonly FoodMeasure[];

	public constructor(details: RecipeDetails, measures: readonly FoodMeasure[]) {
		super(details);
		this.measures = measures;
	}
}
