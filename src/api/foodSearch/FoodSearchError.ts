import type { FitatuApiErrorDetails, FitatuApiErrorOptions } from "../fitatuApiClientBase/FitatuApiError.ts";

export class FoodSearchError extends Error {
	public readonly statusCode?: number;
	public readonly fitatuApiError?: FitatuApiErrorDetails;
	public readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];

	public constructor(message: string, options: FitatuApiErrorOptions = {}) {
		super(message);
		this.name = "FoodSearchError";
		this.statusCode = options.statusCode;
		this.fitatuApiError = options.fitatuApiError;
		this.fitatuApiErrors = options.fitatuApiErrors;
	}
}
