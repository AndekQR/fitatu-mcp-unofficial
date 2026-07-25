import type { FoodTypeName } from "./FoodType.ts";

export class MealItemInput {
	declare public readonly foodId?: string | number;
	declare public readonly productId?: string | number;
	declare public readonly recipeId?: string | number;
	declare public readonly foodType?: FoodTypeName;
	declare public readonly measureId?: string | number;
	declare public readonly measureQuantity?: number;
	declare public readonly ingredientsServing?: number | null;
	declare public readonly eaten?: boolean;
}
