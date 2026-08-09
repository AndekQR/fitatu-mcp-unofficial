export class RemoveMealItemOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly itemId: string;
	public readonly userId?: string;

	public constructor(date: string, mealKey: string, itemId: string, userId?: string) {
		this.date = date;
		this.mealKey = mealKey.trim();
		this.itemId = itemId.trim();
		this.userId = userId;
	}

	public static from(options: RemoveMealItemOptions): RemoveMealItemOptions {
		return new RemoveMealItemOptions(options.date, options.mealKey, options.itemId, options.userId);
	}
}
