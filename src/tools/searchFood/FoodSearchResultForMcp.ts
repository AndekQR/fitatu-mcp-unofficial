import type { FoodSearchResult } from "../../api/foodSearch/FoodSearchResult.ts";
import { FoodSearchQueryResultForMcp } from "./FoodSearchQueryResultForMcp.ts";
import { FoodSearchWarningDetailForMcp } from "./FoodSearchWarningDetailForMcp.ts";

export class FoodSearchResultForMcp {
	public readonly queryCount: number;
	public readonly resultCount: number;
	public readonly results: readonly FoodSearchQueryResultForMcp[];
	public readonly warnings: FoodSearchResult["warnings"];
	public readonly warningDetails: readonly FoodSearchWarningDetailForMcp[];

	public constructor(result: FoodSearchResult) {
		const reusableUserItems = result.userItems.filter((item) => item.foodType !== "CUSTOM_ITEM");
		const reusablePublicItems = result.publicItems.filter((item) => item.foodType !== "CUSTOM_ITEM");
		const omittedCustomItems = [...result.userItems, ...result.publicItems].filter(
			(item) => item.foodType === "CUSTOM_ITEM",
		);
		this.queryCount = result.queryCount;
		this.resultCount = reusableUserItems.length + reusablePublicItems.length;
		this.results = result.queries.map(
			(query, queryIndex) =>
				new FoodSearchQueryResultForMcp({
					queryIndex,
					query,
					userItems: reusableUserItems.filter((item) => item.queryIndex === queryIndex),
					publicItems: reusablePublicItems.filter((item) => item.queryIndex === queryIndex),
				}),
		);
		this.warnings = [
			...result.warnings,
			...omittedCustomItems.map(
				(item) =>
					`Omitted non-reusable CUSTOM_ITEM candidate "${item.displayName}" from search results; create it directly with add_meal_items.`,
			),
		];
		this.warningDetails = result.warningDetails.map((detail) => new FoodSearchWarningDetailForMcp(detail));
	}
}
