import type { FitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";
import type { FoodSearchSource } from "./FoodSearchSource.ts";

export interface FoodSearchWarningDetail {
	readonly message: string;
	readonly errorName: string;
	readonly query?: string;
	readonly source?: FoodSearchSource;
	readonly foodId?: string;
	readonly fitatuApiError?: FitatuApiErrorDetails;
	readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];
}
