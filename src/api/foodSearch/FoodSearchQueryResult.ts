import type { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export interface FoodSearchQueryResult {
	readonly query: string;
	readonly items: readonly NormalizedFoodSearchItem[];
	readonly warnings: readonly string[];
	readonly warningDetails: readonly FoodSearchWarningDetail[];
	readonly searchAttemptCount: number;
	readonly searchSuccessCount: number;
}
