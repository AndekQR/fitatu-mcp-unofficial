import type { FoodSearchItem } from "../../services/foodSearch/FoodSearchTypes.ts";
import { FoodSearchItemForMcp } from "./FoodSearchItemForMcp.ts";

export class FoodSearchQueryResultForMcp {
	public readonly queryIndex: number;
	public readonly query: string;
	public readonly count: number;
	public readonly items: readonly FoodSearchItemForMcp[];

	public constructor(input: {
		readonly queryIndex: number;
		readonly query: string;
		readonly items: readonly FoodSearchItem[];
	}) {
		this.queryIndex = input.queryIndex;
		this.query = input.query;
		this.items = input.items.map((item) => new FoodSearchItemForMcp(item));
		this.count = this.items.length;
	}
}
