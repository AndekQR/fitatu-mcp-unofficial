import type { FoodMeasure } from "./FoodMeasure.ts";
import type { FoodNutrition } from "./FoodNutrition.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";

export interface FoodSearchItem {
	readonly index: number;
	readonly queryIndex: number;
	readonly query: string;
	readonly source: FoodSearchSource;
	readonly foodId: string;
	readonly productId: string;
	readonly foodType: string | null;
	readonly name: string | null;
	readonly displayName: string;
	readonly brand: string | null;
	readonly measureId: string | null;
	readonly measureName: string | null;
	readonly measureQuantity: number | null;
	readonly weightG: number | null;
	readonly kcal: number | null;
	readonly nutritionPer100g: FoodNutrition;
	readonly nutritionPerDefaultMeasure: FoodNutrition;
	readonly verified: boolean | null;
	readonly photoUrl: string | null;
	readonly matchScore: number;
	readonly measures: readonly FoodMeasure[];
}
