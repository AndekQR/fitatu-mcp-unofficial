import type { FoodMeasure } from "../../api/foodSearch/FoodSearchResult.ts";

export class FoodMeasureForMcp {
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly weightG: number | null;
	public readonly unit: string | null;
	public readonly energyKcal: number | null;

	public constructor(measure: FoodMeasure) {
		this.measureId = measure.measureId;
		this.measureName = measure.measureName;
		this.weightG = measure.weightG;
		this.unit = measure.unit;
		this.energyKcal = measure.energyKcal;
	}
}
