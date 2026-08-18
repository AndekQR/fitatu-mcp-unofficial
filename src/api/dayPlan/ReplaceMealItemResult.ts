import type { DayRevisions } from "./DayRevisions.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export class ReplaceMealItemResult extends MealItemMutationResult {
	public readonly operation = "replace";
	public readonly date: string;
	public readonly mealKey: string;
	public readonly previousItemId: string;
	public readonly replacementItem: MealItemOperationSummary;
	public readonly replacementEaten: boolean;

	public constructor(
		date: string,
		mealKey: string,
		previousItemId: string,
		replacementItem: MealItemOperationSummary,
		dayRevisions: DayRevisions,
		replacementEaten: boolean,
	) {
		super(dayRevisions);
		this.date = date;
		this.mealKey = mealKey;
		this.previousItemId = previousItemId;
		this.replacementItem = replacementItem;
		this.replacementEaten = replacementEaten;
	}
}
