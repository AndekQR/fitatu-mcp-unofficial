export class FoodMeasure {
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly weightG: number | null;
	public readonly unit: string | null;
	public readonly energyKcal: number | null;

	public constructor(
		measureId: string | null,
		measureName: string | null,
		weightG: number | null,
		unit: string | null,
		energyKcal: number | null,
	) {
		this.measureId = measureId;
		this.measureName = measureName;
		this.weightG = weightG;
		this.unit = unit;
		this.energyKcal = energyKcal;
	}
}
