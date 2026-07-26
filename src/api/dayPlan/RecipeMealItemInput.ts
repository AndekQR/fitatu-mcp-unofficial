import { CatalogMealItemInput } from "./CatalogMealItemInput.ts";

export class RecipeMealItemInput extends CatalogMealItemInput {
	declare public readonly foodType: "RECIPE";
	declare public readonly recipeId: string | number;
	declare public readonly ingredientsServing?: number | null;
}
