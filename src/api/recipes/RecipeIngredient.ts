export class RecipeIngredient {
	declare public readonly itemId: string;
	declare public readonly productId: string | null;
	declare public readonly recipeId: string | null;
	declare public readonly name: string | null;
	declare public readonly type: "PRODUCT";
	declare public readonly measureId: string;
	declare public readonly measureQuantity: number;
	declare public readonly measureName: string | null;
	declare public readonly measureWeightG: number | null;
}
