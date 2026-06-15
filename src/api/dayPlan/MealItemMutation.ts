export type MealItemOperationName = "add" | "update" | "remove" | "move";

export type MealItemRequestStatus = "accepted";

export type MealItemKind = "auto" | "normal_item" | "custom_add_item" | "custom_recipe_item";

export interface MealItemInput {
	readonly foodId?: string | number;
	readonly productId?: string | number;
	readonly recipeId?: string | number;
	readonly foodType?: string;
	readonly measureId?: string | number;
	readonly measureQuantity?: number;
	readonly ingredientsServing?: number | null;
	readonly eaten?: boolean;
}

export interface MealItemOperationSummary {
	readonly index: number;
	readonly itemId: string;
	readonly productId: string | number | null;
	readonly recipeId: string | number | null;
	readonly foodType: string;
	readonly mealKey: string;
}

export interface MealItemMutationResult {
	readonly status: MealItemRequestStatus;
	readonly operation: MealItemOperationName;
	readonly message: string;
	readonly targetDate: string;
	readonly mealKey: string | null;
	readonly operationCount: number;
	readonly acceptedItems: readonly MealItemOperationSummary[];
	readonly createdItemIds: readonly string[];
	readonly updatedItemIds: readonly string[];
	readonly deletedItemIds: readonly string[];
	readonly oldItemId: string | null;
	readonly newItemId: string | null;
	readonly itemIdChanged: boolean;
}
