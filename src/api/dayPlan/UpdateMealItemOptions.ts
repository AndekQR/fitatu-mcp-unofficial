export class UpdateMealItemOptions {
	public readonly date: string;
	public readonly mealKey: string;
	public readonly itemId: string;
	public readonly measureQuantity?: number;
	public readonly measureId?: string | number;
	public readonly eaten?: boolean;
	public readonly userId?: string;
	public readonly name?: string;
	public readonly energyKcal?: number;
	public readonly proteinG?: number;
	public readonly fatG?: number;
	public readonly carbohydrateG?: number;

	public constructor(
		date: string,
		mealKey: string,
		itemId: string,
		measureQuantity?: number,
		measureId?: string | number,
		eaten?: boolean,
		userId?: string,
		name?: string,
		energyKcal?: number,
		proteinG?: number,
		fatG?: number,
		carbohydrateG?: number,
	) {
		this.date = date;
		this.mealKey = mealKey;
		this.itemId = itemId;
		this.measureQuantity = measureQuantity;
		this.measureId = measureId;
		this.eaten = eaten;
		this.userId = userId;
		this.name = name?.trim();
		this.energyKcal = energyKcal;
		this.proteinG = proteinG;
		this.fatG = fatG;
		this.carbohydrateG = carbohydrateG;
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
			options.name,
			options.energyKcal,
			options.proteinG,
			options.fatG,
			options.carbohydrateG,
		);
	}
}
