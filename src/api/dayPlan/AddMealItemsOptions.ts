import type { MealItemInput } from "./MealItemInput.ts";

export class AddMealItemsOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly items: readonly MealItemInput[];
	public readonly userId?: string;

	public constructor(date: string, mealKey: string, items: readonly MealItemInput[], userId?: string) {
		this.date = date;
		this.mealKey = mealKey.trim();
		this.items = items;
		this.userId = userId;
	}

	public static from(options: AddMealItemsOptions): AddMealItemsOptions {
		return new AddMealItemsOptions(options.date, options.mealKey, options.items, options.userId);
	}
}
