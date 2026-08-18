import type { MealItemInput } from "./MealItemInput.ts";

export class ReplaceMealItemOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly itemId: string;
	public readonly replacement: MealItemInput;
	public readonly userId?: string;

	public constructor(date: string, mealKey: string, itemId: string, replacement: MealItemInput, userId?: string) {
		this.date = date;
		this.mealKey = mealKey.trim();
		this.itemId = itemId.trim();
		this.replacement = replacement;
		this.userId = userId;
	}
}
