export class RecipeNutrition {
	public readonly energyKcal: number | null;
	public readonly proteinG: number | null;
	public readonly fatG: number | null;
	public readonly carbohydrateG: number | null;

	public constructor(
		energyKcal: number | null,
		proteinG: number | null,
		fatG: number | null,
		carbohydrateG: number | null,
	) {
		this.energyKcal = energyKcal;
		this.proteinG = proteinG;
		this.fatG = fatG;
		this.carbohydrateG = carbohydrateG;
	}
}
