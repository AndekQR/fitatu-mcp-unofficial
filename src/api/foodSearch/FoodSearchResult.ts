import type { FitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";

export type FoodSearchSource = "public" | "user";
export type FoodSearchStatus = "ok";

export interface FoodSearchOptions {
	readonly query?: string;
	readonly queries?: readonly string[];
	readonly date?: string;
	readonly locale?: string;
	readonly limit?: number;
	readonly includeUserFood?: boolean;
	readonly includePublicFood?: boolean;
	readonly includeDetails?: boolean;
	readonly detailsLimit?: number;
}

export interface FoodSearchResult {
	readonly status: FoodSearchStatus;
	readonly date: string;
	readonly query: string | null;
	readonly queries: readonly string[];
	readonly queryCount: number;
	readonly count: number;
	readonly items: readonly FoodSearchItem[];
	readonly warnings: readonly string[];
	readonly warningDetails: readonly FoodSearchWarningDetail[];
	readonly message: string;
}

export interface FoodSearchWarningDetail {
	readonly message: string;
	readonly errorName: string;
	readonly query?: string;
	readonly source?: FoodSearchSource;
	readonly foodId?: string;
	readonly fitatuApiError?: FitatuApiErrorDetails;
	readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];
}

export interface FoodSearchItem {
	readonly index: number;
	readonly queryIndex: number;
	readonly query: string;
	readonly source: FoodSearchSource;
	readonly foodId: string;
	readonly productId: string;
	readonly foodType: string | null;
	readonly name: string | null;
	readonly displayName: string;
	readonly brand: string | null;
	readonly measureId: string | null;
	readonly measureName: string | null;
	readonly measureQuantity: number | null;
	readonly weightG: number | null;
	readonly kcal: number | null;
	readonly nutritionPer100g: FoodNutrition;
	readonly nutritionPerDefaultMeasure: FoodNutrition;
	readonly verified: boolean | null;
	readonly photoUrl: string | null;
	readonly matchScore: number;
	readonly measures: readonly FoodMeasure[];
}

export interface FoodMeasure {
	readonly measureId: string | null;
	readonly measureName: string | null;
	readonly weightG: number | null;
	readonly unit: string | null;
	readonly energyKcal: number | null;
}

export interface FoodNutrition {
	readonly energyKcal: number | null;
	readonly proteinG: number | null;
	readonly fatG: number | null;
	readonly carbsG: number | null;
	readonly fiberG: number | null;
	readonly sugarsG: number | null;
	readonly saltG: number | null;
	readonly saturatedFatG: number | null;
}
