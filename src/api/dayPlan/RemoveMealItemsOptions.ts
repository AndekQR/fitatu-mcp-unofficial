export class RemoveMealItemsOptions {
	public readonly date: string;
	public readonly itemIds: readonly string[];
	public readonly userId?: string;

	public constructor(date: string, itemIds: readonly string[], userId?: string) {
		this.date = date;
		this.itemIds = itemIds;
		this.userId = userId;
	}

	public static from(options: RemoveMealItemsOptions): RemoveMealItemsOptions {
		return new RemoveMealItemsOptions(options.date, options.itemIds, options.userId);
	}
}
