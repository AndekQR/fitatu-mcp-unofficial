export class UpdateMealItemOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly itemId: string;
	public readonly measureQuantity?: number;
	public readonly measureId?: string | number;
	public readonly eaten?: boolean;
	public readonly userId?: string;

	public constructor(
		date: string,
		mealKey: string,
		itemId: string,
		measureQuantity?: number,
		measureId?: string | number,
		eaten?: boolean,
		userId?: string,
	) {
		this.date = date;
		this.mealKey = mealKey;
		this.itemId = itemId;
		this.measureQuantity = measureQuantity;
		this.measureId = measureId;
		this.eaten = eaten;
		this.userId = userId;
	}

	public static from(options: UpdateMealItemOptions): UpdateMealItemOptions {
		return new UpdateMealItemOptions(
			options.date,
			options.mealKey,
			options.itemId,
			options.measureQuantity,
			options.measureId,
			options.eaten,
			options.userId,
		);
	}
}
