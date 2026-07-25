export class MealItemOperationSummary {
	public readonly index: number;
	public readonly itemId: string;
	public readonly productId: string | number | null;
	public readonly recipeId: string | number | null;
	public readonly foodType: string;
	public readonly mealKey: string;

	public constructor(
		index: number,
		itemId: string,
		productId: string | number | null,
		recipeId: string | number | null,
		foodType: string,
		mealKey: string,
	) {
		this.index = index;
		this.itemId = itemId;
		this.productId = productId;
		this.recipeId = recipeId;
		this.foodType = foodType;
		this.mealKey = mealKey;
	}
}
