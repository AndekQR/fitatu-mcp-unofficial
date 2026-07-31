import { NormalizedFoodSearchItem } from "./NormalizedFoodSearchItem.ts";

export class FoodSearchItem extends NormalizedFoodSearchItem {
	public readonly index: number;
	public readonly queryIndex: number;
	public readonly query: string;
	public readonly productId: string;
	public readonly displayName: string;

	public constructor(
		item: NormalizedFoodSearchItem,
		index: number,
		queryIndex: number,
		query: string,
		displayName: string,
	) {
		super(item);
		this.index = index;
		this.queryIndex = queryIndex;
		this.query = query;
		this.productId = item.foodId;
		this.displayName = displayName;
	}
}
