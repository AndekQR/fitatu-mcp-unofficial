import { FoodSearchClient } from "../../api/foodSearch/FoodSearchClient.ts";
import type { FoodSearchOptions } from "../../api/foodSearch/FoodSearchOptions.ts";
import type { FoodSearchResult } from "../../api/foodSearch/FoodSearchResult.ts";

export class FoodSearchService {
	private readonly foodSearchClient;

	public constructor(foodSearchClient: FoodSearchClient) {
		this.foodSearchClient = foodSearchClient;
	}

	public search(options: FoodSearchOptions): Promise<FoodSearchResult> {
		return this.foodSearchClient.search(options);
	}
}
