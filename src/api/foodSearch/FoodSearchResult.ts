import type { FoodSearchItem } from "./FoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export interface FoodSearchResult {
	readonly date: string;
	readonly queries: readonly string[];
	readonly queryCount: number;
	readonly count: number;
	readonly items: readonly FoodSearchItem[];
	readonly warnings: readonly string[];
	readonly warningDetails: readonly FoodSearchWarningDetail[];
}
