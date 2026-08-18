import type { FoodSearchItem } from "../../api/foodSearch/FoodSearchItem.ts";
import { FoodSearchItemForMcp } from "./FoodSearchItemForMcp.ts";

export class FoodSearchQueryResultForMcp {
	public readonly queryIndex: number;
	public readonly query: string;
	public readonly count: number;
	public readonly userItems: readonly FoodSearchItemForMcp[];
	public readonly publicItems: readonly FoodSearchItemForMcp[];

	public constructor(input: {
		readonly queryIndex: number;
		readonly query: string;
		readonly userItems: readonly FoodSearchItem[];
		readonly publicItems: readonly FoodSearchItem[];
	}) {
		this.queryIndex = input.queryIndex;
		this.query = input.query;
		this.userItems = input.userItems.map((item) => new FoodSearchItemForMcp(item));
		this.publicItems = input.publicItems.map((item) => new FoodSearchItemForMcp(item));
		this.count = this.userItems.length + this.publicItems.length;
	}
}
