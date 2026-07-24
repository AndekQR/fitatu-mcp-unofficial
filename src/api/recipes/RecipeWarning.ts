export interface RecipeWarning {
	readonly code: "DUPLICATE_INGREDIENT_SELECTION";
	readonly message: string;
	readonly itemId: string;
	readonly measureId: string;
	readonly indexes: readonly number[];
}
