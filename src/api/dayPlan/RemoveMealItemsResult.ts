import type { DayRevisions } from "./DayRevisions.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export class RemoveMealItemsResult extends MealItemMutationResult {
	public readonly operation = "remove";
	public readonly date: string;
	public readonly removedItems: readonly MealItemOperationSummary[];

	public constructor(date: string, removedItems: readonly MealItemOperationSummary[], dayRevisions: DayRevisions) {
		super(dayRevisions);
		this.date = date;
		this.removedItems = removedItems;
	}
}
