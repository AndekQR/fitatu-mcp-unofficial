import type { DayRevisions } from "./DayRevisions.ts";

export type MealItemOperationName = "add" | "update" | "remove" | "move" | "replace";

export abstract class MealItemMutationResult {
	public abstract readonly operation: MealItemOperationName;
	public readonly dayRevisions: DayRevisions;

	protected constructor(dayRevisions: DayRevisions) {
		this.dayRevisions = dayRevisions;
	}
}
