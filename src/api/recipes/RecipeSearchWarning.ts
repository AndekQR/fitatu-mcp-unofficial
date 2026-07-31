import type { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import type { RecipeSearchSource } from "./RecipeSearchSource.ts";

export type RecipeSearchWarningCode = "RECIPE_SOURCE_UNAVAILABLE" | "RECIPE_DETAILS_UNAVAILABLE";

export class RecipeSearchWarning {
	public readonly code: RecipeSearchWarningCode;
	public readonly source: RecipeSearchSource;
	public readonly message: string;
	public readonly clientError: FitatuClientError;

	public constructor(
		code: RecipeSearchWarningCode,
		source: RecipeSearchSource,
		message: string,
		clientError: FitatuClientError,
	) {
		this.code = code;
		this.source = source;
		this.message = message;
		this.clientError = clientError;
	}
}
