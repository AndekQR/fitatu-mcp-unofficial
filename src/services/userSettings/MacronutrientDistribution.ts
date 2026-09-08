export class MacronutrientDistribution {
	public readonly proteinPercentage: number | null;
	public readonly fatPercentage: number | null;
	public readonly carbohydratePercentage: number | null;

	public constructor(
		proteinPercentage: number | null,
		fatPercentage: number | null,
		carbohydratePercentage: number | null,
	) {
		this.proteinPercentage = proteinPercentage;
		this.fatPercentage = fatPercentage;
		this.carbohydratePercentage = carbohydratePercentage;
	}
}
