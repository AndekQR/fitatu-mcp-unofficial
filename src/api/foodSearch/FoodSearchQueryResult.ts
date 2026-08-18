import type { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export class FoodSearchQueryResult {
	public readonly query: string;
	public readonly userItems: readonly NormalizedFoodSearchItem[];
	public readonly publicItems: readonly NormalizedFoodSearchItem[];
	public readonly warnings: readonly string[];
	public readonly warningDetails: readonly FoodSearchWarningDetail[];
	public readonly searchAttemptCount: number;
	public readonly searchSuccessCount: number;

	public constructor(
		query: string,
		userItems: readonly NormalizedFoodSearchItem[],
		publicItems: readonly NormalizedFoodSearchItem[],
		warnings: readonly string[],
		warningDetails: readonly FoodSearchWarningDetail[],
		searchAttemptCount: number,
		searchSuccessCount: number,
	) {
		this.query = query;
		this.userItems = userItems;
		this.publicItems = publicItems;
		this.warnings = warnings;
		this.warningDetails = warningDetails;
		this.searchAttemptCount = searchAttemptCount;
		this.searchSuccessCount = searchSuccessCount;
	}
}
