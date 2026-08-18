import type { FoodTypeName } from "../dayPlan/FoodType.ts";

export class FoodDetailsRequest {
	public readonly foodId: string;
	public readonly foodType: FoodTypeName;

	public constructor(foodId: string, foodType: FoodTypeName) {
		this.foodId = foodId;
		this.foodType = foodType;
	}
}
