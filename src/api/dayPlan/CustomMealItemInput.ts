export class CustomMealItemInput {
	public readonly foodType = "CUSTOM_ITEM";
	public readonly name: string;
	public readonly energyKcal: number;
	public readonly proteinG?: number;
	public readonly fatG?: number;
	public readonly carbohydrateG?: number;
	public readonly eaten?: boolean;

	public constructor(
		name: string,
		energyKcal: number,
		proteinG?: number,
		fatG?: number,
		carbohydrateG?: number,
		eaten?: boolean,
	) {
		this.name = name;
		this.energyKcal = energyKcal;
		this.proteinG = proteinG;
		this.fatG = fatG;
		this.carbohydrateG = carbohydrateG;
		this.eaten = eaten;
	}
}
