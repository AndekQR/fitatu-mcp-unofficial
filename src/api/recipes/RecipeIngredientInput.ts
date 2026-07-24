export class RecipeIngredientInput {
	declare public readonly itemId: string | number;
	declare public readonly measureId: string | number;
	declare public readonly measureQuantity: number;
	declare public readonly type: "PRODUCT";
}
