import type { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";

export interface FoodSearchWarningDetail {
	readonly message: string;
	readonly clientError: FitatuClientError;
	readonly query?: string;
	readonly source?: FoodSearchSource;
	readonly foodId?: string;
}
