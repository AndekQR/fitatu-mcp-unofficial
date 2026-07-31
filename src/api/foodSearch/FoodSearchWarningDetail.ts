import type { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";

export class FoodSearchWarningDetail {
	public readonly message: string;
	public readonly clientError: FitatuClientError;
	public readonly query?: string;
	public readonly source?: FoodSearchSource;
	public readonly foodId?: string;

	public constructor(
		message: string,
		clientError: FitatuClientError,
		query?: string,
		source?: FoodSearchSource,
		foodId?: string,
	) {
		this.message = message;
		this.clientError = clientError;
		this.query = query;
		this.source = source;
		this.foodId = foodId;
	}
}
