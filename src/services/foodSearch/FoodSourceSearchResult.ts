import type { FoodSearchWarningDetail } from "../../api/foodSearch/FoodSearchWarningDetail.ts";
import type { NormalizedFoodSearchItem } from "../../api/foodSearch/NormalizedFoodSearchItem.ts";

export class FoodSourceSearchResult {
	public readonly items: readonly NormalizedFoodSearchItem[];
	public readonly warnings: readonly string[];
	public readonly warningDetails: readonly FoodSearchWarningDetail[];
	public readonly succeeded: boolean;

	private constructor(
		items: readonly NormalizedFoodSearchItem[],
		warnings: readonly string[],
		warningDetails: readonly FoodSearchWarningDetail[],
		succeeded: boolean,
	) {
		this.items = items;
		this.warnings = warnings;
		this.warningDetails = warningDetails;
		this.succeeded = succeeded;
	}

	public static success(items: readonly NormalizedFoodSearchItem[]): FoodSourceSearchResult {
		return new FoodSourceSearchResult(items, [], [], true);
	}

	public static failure(message: string, detail: FoodSearchWarningDetail): FoodSourceSearchResult {
		return new FoodSourceSearchResult([], [message], [detail], false);
	}
}
