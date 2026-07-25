export type MealItemKind = "auto" | "normal_item" | "custom_add_item" | "custom_recipe_item";

export class RemoveMealItemOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly itemId: string;
	public readonly itemKind?: MealItemKind;
	public readonly userId?: string;

	public constructor(date: string, mealKey: string, itemId: string, itemKind?: MealItemKind, userId?: string) {
		this.date = date;
		this.mealKey = mealKey;
		this.itemId = itemId;
		this.itemKind = itemKind;
		this.userId = userId;
	}

	public static from(options: RemoveMealItemOptions): RemoveMealItemOptions {
		return new RemoveMealItemOptions(
			options.date,
			options.mealKey,
			options.itemId,
			options.itemKind,
			options.userId,
		);
	}
}
