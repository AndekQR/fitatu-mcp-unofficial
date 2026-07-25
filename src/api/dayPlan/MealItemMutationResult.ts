import type { MealItemOperationSummary } from "./MealItemOperationSummary.ts";

export type MealItemOperationName = "add" | "update" | "remove" | "move";

export class MealItemMutationResult {
	public readonly status = "accepted";
	public readonly operationCount: number;
	public readonly itemIdChanged: boolean;
	public readonly operation: MealItemOperationName;
	public readonly message: string;
	public readonly targetDate: string;
	public readonly mealKey: string | null;
	public readonly acceptedItems: readonly MealItemOperationSummary[];
	public readonly provisionalItemIds: readonly string[];
	public readonly updatedItemIds: readonly string[];
	public readonly deletedItemIds: readonly string[];
	public readonly oldItemId: string | null;
	public readonly newItemId: string | null;

	private constructor(
		operation: MealItemOperationName,
		message: string,
		targetDate: string,
		mealKey: string | null,
		acceptedItems: readonly MealItemOperationSummary[],
		provisionalItemIds: readonly string[],
		updatedItemIds: readonly string[],
		deletedItemIds: readonly string[],
		oldItemId: string | null,
		newItemId: string | null,
	) {
		this.operation = operation;
		this.message = message;
		this.targetDate = targetDate;
		this.mealKey = mealKey;
		this.acceptedItems = acceptedItems;
		this.provisionalItemIds = provisionalItemIds;
		this.updatedItemIds = updatedItemIds;
		this.deletedItemIds = deletedItemIds;
		this.oldItemId = oldItemId;
		this.newItemId = newItemId;
		this.operationCount = acceptedItems.length;
		this.itemIdChanged = oldItemId !== null && newItemId !== null && oldItemId !== newItemId;
	}

	public static acceptedAdd(
		targetDate: string,
		mealKey: string,
		acceptedItems: readonly MealItemOperationSummary[],
	): MealItemMutationResult {
		return new MealItemMutationResult(
			"add",
			"Meal item add request accepted by Fitatu.",
			targetDate,
			mealKey,
			acceptedItems,
			acceptedItems.map(({ itemId }) => itemId),
			[],
			[],
			null,
			null,
		);
	}

	public static acceptedUpdate(targetDate: string, acceptedItem: MealItemOperationSummary): MealItemMutationResult {
		return new MealItemMutationResult(
			"update",
			"Meal item update request accepted by Fitatu.",
			targetDate,
			acceptedItem.mealKey,
			[acceptedItem],
			[],
			[acceptedItem.itemId],
			[],
			null,
			null,
		);
	}

	public static acceptedRemove(
		targetDate: string,
		acceptedItems: readonly MealItemOperationSummary[],
		mealKey: string | null = null,
	): MealItemMutationResult {
		return new MealItemMutationResult(
			"remove",
			"Meal item remove request accepted by Fitatu.",
			targetDate,
			mealKey,
			acceptedItems,
			[],
			[],
			acceptedItems.map(({ itemId }) => itemId),
			null,
			null,
		);
	}

	public static acceptedMove(
		targetDate: string,
		sourceMealKey: string,
		oldItemId: string,
		acceptedItem: MealItemOperationSummary,
	): MealItemMutationResult {
		return new MealItemMutationResult(
			"move",
			"Meal item move request accepted by Fitatu.",
			targetDate,
			sourceMealKey,
			[acceptedItem],
			[acceptedItem.itemId],
			[],
			[oldItemId],
			oldItemId,
			acceptedItem.itemId,
		);
	}
}
