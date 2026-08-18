import type { DayRevisions } from "./DayRevisions.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export class UpdateMealItemResult extends MealItemMutationResult {
	public readonly operation = "update";
	public readonly date: string;
	public readonly updatedItem: MealItemOperationSummary;

	public constructor(date: string, updatedItem: MealItemOperationSummary, dayRevisions: DayRevisions) {
		super(dayRevisions);
		this.date = date;
		this.updatedItem = updatedItem;
	}
}
