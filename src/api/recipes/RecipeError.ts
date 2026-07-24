import {
	createFitatuApiErrorDetails,
	type FitatuApiErrorDetails,
	type FitatuApiErrorOptions,
} from "../fitatuApiClientBase/FitatuApiError.ts";

export type RecipeErrorCode =
	| "INVALID_ARGUMENT"
	| "INVALID_MEAL_KEY"
	| "INVALID_MEASURE_ID"
	| "INVALID_PRODUCT_ID"
	| "RECIPE_NAME_MISMATCH"
	| "RECIPE_NOT_EDITABLE"
	| "RECIPE_NOT_FOUND"
	| "RECIPE_NOT_OWNED"
	| "UPSTREAM_ERROR";

export interface RecipeErrorOptions extends FitatuApiErrorOptions {
	readonly code?: RecipeErrorCode;
	readonly parameter?: string;
	readonly retryable?: boolean;
}

export class RecipeError extends Error {
	public readonly statusCode?: number;
	public readonly fitatuApiError?: FitatuApiErrorDetails;
	public readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];
	public readonly code: RecipeErrorCode;
	public readonly parameter?: string;
	public readonly retryable: boolean;

	public constructor(message: string, options: RecipeErrorOptions = {}) {
		super(message);
		this.name = "RecipeError";
		this.statusCode = options.statusCode;
		this.fitatuApiError = options.fitatuApiError;
		this.fitatuApiErrors = options.fitatuApiErrors;
		this.code = options.code ?? "UPSTREAM_ERROR";
		this.parameter = options.parameter;
		this.retryable = options.retryable ?? isRetryableStatus(options.statusCode);
	}

	public static async fromResponse(
		response: Response,
		method: string,
		path: string,
		message: string,
	): Promise<RecipeError> {
		const fitatuApiError = await createFitatuApiErrorDetails(response, { method, path });
		const classification = classifyRecipeApiError(response.status, path, fitatuApiError);
		return new RecipeError(message, {
			statusCode: response.status,
			fitatuApiError,
			...classification,
		});
	}
}

function classifyRecipeApiError(
	statusCode: number,
	path: string,
	details: FitatuApiErrorDetails,
): Pick<RecipeErrorOptions, "code" | "parameter" | "retryable"> {
	if (
		(statusCode === 404 || statusCode === 410) &&
		(path.startsWith("/recipes/") || path.startsWith("/recipes-and-user-action/"))
	) {
		return { code: "RECIPE_NOT_FOUND", retryable: false };
	}

	const upstreamDescription = `${details.upstreamCode ?? ""} ${details.upstreamMessage ?? ""}`.toLowerCase();
	if (upstreamDescription.includes("measure")) {
		return { code: "INVALID_MEASURE_ID", parameter: "ingredients[].measureId", retryable: false };
	}
	if (upstreamDescription.includes("product") || upstreamDescription.includes("item")) {
		return { code: "INVALID_PRODUCT_ID", parameter: "ingredients[].itemId", retryable: false };
	}

	return { code: "UPSTREAM_ERROR", retryable: isRetryableStatus(statusCode) };
}

function isRetryableStatus(statusCode: number | undefined): boolean {
	return statusCode === 408 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500);
}
