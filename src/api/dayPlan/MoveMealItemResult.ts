import type { DayRevisions } from "./DayRevisions.ts";
import { MealItemMutationResult } from "./MealItemMutationResult.ts";
import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export class MoveMealItemResult extends MealItemMutationResult {
	public readonly operation = "move";
	public readonly fromDate: string;
	public readonly fromMealKey: string;
	public readonly previousItemId: string;
	public readonly toDate: string;
	public readonly movedItem: MealItemOperationSummary;

	public constructor(
		fromDate: string,
		fromMealKey: string,
		previousItemId: string,
		toDate: string,
		movedItem: MealItemOperationSummary,
		dayRevisions: DayRevisions,
	) {
		super(dayRevisions);
		this.fromDate = fromDate;
		this.fromMealKey = fromMealKey;
		this.previousItemId = previousItemId;
		this.toDate = toDate;
		this.movedItem = movedItem;
	}
}
