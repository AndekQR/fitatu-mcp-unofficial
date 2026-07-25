import type { MealItemKind } from "./RemoveMealItemOptions.ts";

export class RemoveMealItemsOptions {
	public readonly date: string;
	public readonly itemIds: readonly string[];
	public readonly itemKinds?: Readonly<Record<string, MealItemKind>>;
	public readonly userId?: string;

	public constructor(
		date: string,
		itemIds: readonly string[],
		itemKinds?: Readonly<Record<string, MealItemKind>>,
		userId?: string,
	) {
		this.date = date;
		this.itemIds = itemIds;
		this.itemKinds = itemKinds;
		this.userId = userId;
	}

	public static from(options: RemoveMealItemsOptions): RemoveMealItemsOptions {
		return new RemoveMealItemsOptions(options.date, options.itemIds, options.itemKinds, options.userId);
	}
}
