export class MoveMealItemOptions {
	public readonly fromDate: string;
	public readonly fromMealKey: string;
	public readonly itemId: string;
	public readonly toDate?: string;
	public readonly toMealKey?: string;
	public readonly userId?: string;

	public constructor(
		fromDate: string,
		fromMealKey: string,
		itemId: string,
		toDate?: string,
		toMealKey?: string,
		userId?: string,
	) {
		this.fromDate = fromDate;
		this.fromMealKey = fromMealKey.trim();
		this.itemId = itemId.trim();
		this.toDate = toDate;
		this.toMealKey = toMealKey?.trim();
		this.userId = userId;
	}

	public static from(options: MoveMealItemOptions): MoveMealItemOptions {
		return new MoveMealItemOptions(
			options.fromDate,
			options.fromMealKey,
			options.itemId,
			options.toDate,
			options.toMealKey,
			options.userId,
		);
	}
}
