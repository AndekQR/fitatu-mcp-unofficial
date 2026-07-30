import type { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export class FoodSearchQueryResult {
	public readonly query: string;
	public readonly items: readonly NormalizedFoodSearchItem[];
	public readonly warnings: readonly string[];
	public readonly warningDetails: readonly FoodSearchWarningDetail[];
	public readonly searchAttemptCount: number;
	public readonly searchSuccessCount: number;

	public constructor(
		query: string,
		items: readonly NormalizedFoodSearchItem[],
		warnings: readonly string[],
		warningDetails: readonly FoodSearchWarningDetail[],
		searchAttemptCount: number,
		searchSuccessCount: number,
	) {
		this.query = query;
		this.items = items;
		this.warnings = warnings;
		this.warningDetails = warningDetails;
		this.searchAttemptCount = searchAttemptCount;
		this.searchSuccessCount = searchSuccessCount;
	}
}
