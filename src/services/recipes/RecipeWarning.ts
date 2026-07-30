export class RecipeWarning {
	public readonly code = "DUPLICATE_INGREDIENT_SELECTION";
	public readonly message: string;
	public readonly itemId: string;
	public readonly measureId: string;
	public readonly indexes: readonly number[];

	public constructor(message: string, itemId: string, measureId: string, indexes: readonly number[]) {
		this.message = message;
		this.itemId = itemId;
		this.measureId = measureId;
		this.indexes = indexes;
	}
}
