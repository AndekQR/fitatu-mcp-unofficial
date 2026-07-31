export class RecipeIngredientInput {
	public readonly itemId: string | number;
	public readonly measureId: string | number;
	public readonly measureQuantity: number;
	public readonly type = "PRODUCT";

	public constructor(itemId: string | number, measureId: string | number, measureQuantity: number) {
		this.itemId = itemId;
		this.measureId = measureId;
		this.measureQuantity = measureQuantity;
	}
}
