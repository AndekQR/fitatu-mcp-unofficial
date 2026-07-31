export class FoodNutrition {
	public readonly energyKcal: number | null;
	public readonly proteinG: number | null;
	public readonly fatG: number | null;
	public readonly carbsG: number | null;
	public readonly fiberG: number | null;
	public readonly sugarsG: number | null;
	public readonly saltG: number | null;
	public readonly saturatedFatG: number | null;

	public constructor(
		energyKcal: number | null,
		proteinG: number | null,
		fatG: number | null,
		carbsG: number | null,
		fiberG: number | null,
		sugarsG: number | null,
		saltG: number | null,
		saturatedFatG: number | null,
	) {
		this.energyKcal = energyKcal;
		this.proteinG = proteinG;
		this.fatG = fatG;
		this.carbsG = carbsG;
		this.fiberG = fiberG;
		this.sugarsG = sugarsG;
		this.saltG = saltG;
		this.saturatedFatG = saturatedFatG;
	}
}
