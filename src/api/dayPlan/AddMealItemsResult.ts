import type { DayRevisions } from "./DayRevisions.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export class AddMealItemsResult extends MealItemMutationResult {
	public readonly operation = "add";
	public readonly date: string;
	public readonly mealKey: string;
	public readonly addedItems: readonly MealItemOperationSummary[];

	public constructor(
		date: string,
		mealKey: string,
		addedItems: readonly MealItemOperationSummary[],
		dayRevisions: DayRevisions,
	) {
		super(dayRevisions);
		this.date = date;
		this.mealKey = mealKey;
		this.addedItems = addedItems;
	}
}
