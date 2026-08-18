export class FoodMeasureApiResponse {
	public readonly measureId: string | null;
	public readonly measureName: string | null;
	public readonly weight: number | null;
	public readonly unit: string | null;
	public readonly energy: number | null;

	public constructor(
		measureId: string | null,
		measureName: string | null,
		weight: number | null,
		unit: string | null,
		energy: number | null,
	) {
		this.measureId = measureId;
		this.measureName = measureName;
		this.weight = weight;
		this.unit = unit;
		this.energy = energy;
	}
}
