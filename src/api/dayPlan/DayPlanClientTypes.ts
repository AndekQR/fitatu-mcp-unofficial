import type { MealItemInput, MealItemKind } from "./MealItemMutation.ts";

export interface GetDayPlanOptions {
	readonly date: string;
	readonly userId?: string;
	readonly withRating?: boolean;
}

export interface AddMealItemsOptions {
	readonly date: string;
	readonly mealKey: string;
	readonly items: readonly MealItemInput[];
	readonly userId?: string;
}

export interface UpdateMealItemOptions {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
	readonly measureQuantity?: number;
	readonly measureId?: string | number;
	readonly eaten?: boolean;
	readonly userId?: string;
}

export interface RemoveMealItemOptions {
	readonly date: string;
	readonly mealKey: string;
	readonly itemId: string;
	readonly itemKind?: MealItemKind;
	readonly userId?: string;
}

export interface RemoveMealItemsOptions {
	readonly date: string;
	readonly productIds: readonly (string | number)[];
	readonly userId?: string;
}

export interface MoveMealItemOptions {
	readonly fromDate: string;
	readonly fromMealKey: string;
	readonly itemId: string;
	readonly toDate?: string;
	readonly toMealKey?: string;
	readonly userId?: string;
}
