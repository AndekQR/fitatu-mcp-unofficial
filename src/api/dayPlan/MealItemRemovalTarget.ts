export class MealItemRemovalTarget {
	public readonly mealKey: string;
	public readonly itemId: string;

	public constructor(mealKey: string, itemId: string) {
		this.mealKey = mealKey.trim();
		this.itemId = itemId.trim();
	}
}
