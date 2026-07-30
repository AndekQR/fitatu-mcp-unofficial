import { CatalogMealItemInput } from "./CatalogMealItemInput.ts";

export class RecipeMealItemInput extends CatalogMealItemInput {
	public readonly foodType = "RECIPE";
	public readonly recipeId: string | number;
	public readonly ingredientsServing?: number | null;

	public constructor(
		recipeId: string | number,
		measureId: string | number,
		measureQuantity?: number,
		eaten?: boolean,
		ingredientsServing?: number | null,
	) {
		super(measureId, measureQuantity, eaten);
		this.recipeId = recipeId;
		this.ingredientsServing = ingredientsServing;
	}
}
