import type { FoodSearchItem } from "./FoodSearchItem.ts";
import type { FoodSearchWarningDetail } from "./FoodSearchWarningDetail.ts";

export class FoodSearchResult {
	public readonly date: string;
	public readonly queries: readonly string[];
	public readonly queryCount: number;
	public readonly count: number;
	public readonly userItems: readonly FoodSearchItem[];
	public readonly publicItems: readonly FoodSearchItem[];
	public readonly warnings: readonly string[];
	public readonly warningDetails: readonly FoodSearchWarningDetail[];

	public constructor(
		date: string,
		queries: readonly string[],
		userItems: readonly FoodSearchItem[],
		publicItems: readonly FoodSearchItem[],
		warnings: readonly string[],
		warningDetails: readonly FoodSearchWarningDetail[],
	) {
		this.date = date;
		this.queries = queries;
		this.queryCount = queries.length;
		this.count = userItems.length + publicItems.length;
		this.userItems = userItems;
		this.publicItems = publicItems;
		this.warnings = warnings;
		this.warningDetails = warningDetails;
	}
}
