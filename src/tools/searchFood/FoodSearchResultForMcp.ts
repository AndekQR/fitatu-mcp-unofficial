import type { FoodSearchResult } from "../../services/foodSearch/FoodSearchTypes.ts";
import type { FoodSearchWarningDetail } from "../../api/foodSearch/FoodSearchWarningDetail.ts";
import { FoodSearchQueryResultForMcp } from "./FoodSearchQueryResultForMcp.ts";

export class FoodSearchResultForMcp {
	public readonly queryCount: number;
	public readonly resultCount: number;
	public readonly results: readonly FoodSearchQueryResultForMcp[];
	public readonly warnings: FoodSearchResult["warnings"];
	public readonly warningDetails: readonly Omit<FoodSearchWarningDetail, "foodId">[];

	public constructor(result: FoodSearchResult) {
		const reusableItems = result.items.filter((item) => item.foodType !== "CUSTOM_ITEM");
		const omittedCustomItems = result.items.filter((item) => item.foodType === "CUSTOM_ITEM");
		this.queryCount = result.queryCount;
		this.resultCount = reusableItems.length;
		this.results = result.queries.map(
			(query, queryIndex) =>
				new FoodSearchQueryResultForMcp({
					queryIndex,
					query,
					items: reusableItems.filter((item) => item.queryIndex === queryIndex),
				}),
		);
		this.warnings = [
			...result.warnings,
			...omittedCustomItems.map(
				(item) =>
					`Omitted non-reusable CUSTOM_ITEM candidate "${item.displayName}" from search results; create it directly with add_meal_items.`,
			),
		];
		this.warningDetails = result.warningDetails.map(({ foodId: _foodId, ...detail }) => detail);
	}
}
