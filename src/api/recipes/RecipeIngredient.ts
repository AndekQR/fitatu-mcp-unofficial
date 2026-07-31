export class RecipeIngredient {
	public readonly itemId: string;
	public readonly productId: string | null;
	public readonly recipeId: string | null;
	public readonly name: string | null;
	public readonly type = "PRODUCT";
	public readonly measureId: string;
	public readonly measureQuantity: number;
	public readonly measureName: string | null;
	public readonly measureWeightG: number | null;

	public constructor(
		itemId: string,
		productId: string | null,
		recipeId: string | null,
		name: string | null,
		measureId: string,
		measureQuantity: number,
		measureName: string | null,
		measureWeightG: number | null,
	) {
		this.itemId = itemId;
		this.productId = productId;
		this.recipeId = recipeId;
		this.name = name;
		this.measureId = measureId;
		this.measureQuantity = measureQuantity;
		this.measureName = measureName;
		this.measureWeightG = measureWeightG;
	}
}
