export abstract class CatalogMealItemInput {
	public readonly measureId: string | number;
	public readonly measureQuantity?: number;
	public readonly eaten?: boolean;

	protected constructor(measureId: string | number, measureQuantity?: number, eaten?: boolean) {
		this.measureId = measureId;
		this.measureQuantity = measureQuantity;
		this.eaten = eaten;
	}
}
