import type { FoodSearchResult } from "../../services/foodSearch/FoodSearchTypes.ts";
import { FoodSearchQueryResultForMcp } from "./FoodSearchQueryResultForMcp.ts";

export class FoodSearchResultForMcp {
	public readonly queryCount: number;
	public readonly resultCount: number;
	public readonly results: readonly FoodSearchQueryResultForMcp[];
	public readonly warnings: FoodSearchResult["warnings"];
	public readonly warningDetails: FoodSearchResult["warningDetails"];

	public constructor(result: FoodSearchResult) {
		this.queryCount = result.queryCount;
		this.resultCount = result.count;
		this.results = result.queries.map(
			(query, queryIndex) =>
				new FoodSearchQueryResultForMcp({
					queryIndex,
					query,
					items: result.items.filter((item) => item.queryIndex === queryIndex),
				}),
		);
		this.warnings = result.warnings;
		this.warningDetails = result.warningDetails;
	}
}
