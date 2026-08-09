import { MealItemRemovalTarget } from "./MealItemRemovalTarget.ts";

export class RemoveMealItemsOptions {
	public readonly date: string;
	public readonly items: readonly MealItemRemovalTarget[];
	public readonly userId?: string;

	public constructor(date: string, items: readonly MealItemRemovalTarget[], userId?: string) {
		this.date = date;
		this.items = items;
		this.userId = userId;
	}

	public static from(options: RemoveMealItemsOptions): RemoveMealItemsOptions {
		return new RemoveMealItemsOptions(
			options.date,
			options.items.map((item) => new MealItemRemovalTarget(item.mealKey, item.itemId)),
			options.userId,
		);
	}
}
