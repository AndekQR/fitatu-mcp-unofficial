import type { FoodSearchItem } from "./FoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export class FoodSearchResult {
	public readonly date: string;
	public readonly queries: readonly string[];
	public readonly queryCount: number;
	public readonly count: number;
	public readonly items: readonly FoodSearchItem[];
	public readonly warnings: readonly string[];
	public readonly warningDetails: readonly FoodSearchWarningDetail[];

	public constructor(
		date: string,
		queries: readonly string[],
		items: readonly FoodSearchItem[],
		warnings: readonly string[],
		warningDetails: readonly FoodSearchWarningDetail[],
	) {
		this.date = date;
		this.queries = queries;
		this.queryCount = queries.length;
		this.count = items.length;
		this.items = items;
		this.warnings = warnings;
		this.warningDetails = warningDetails;
	}
}
