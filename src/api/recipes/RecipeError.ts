import {
	createFitatuApiErrorDetails,
	type FitatuApiErrorDetails,
	type FitatuApiErrorOptions,
} from "../fitatuApiClientBase/FitatuApiError.ts";

const RECIPE_NOT_FOUND_STATUS_CODES = new Set([404, 410]);

export class RecipeError extends Error {
	public readonly statusCode?: number;
	public readonly fitatuApiError?: FitatuApiErrorDetails;
	public readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];

	public constructor(message: string, options: FitatuApiErrorOptions = {}) {
		super(message);
		this.name = "RecipeError";
		this.statusCode = options.statusCode;
		this.fitatuApiError = options.fitatuApiError;
		this.fitatuApiErrors = options.fitatuApiErrors;
	}

	public static isNotFound(error: unknown): error is RecipeError {
		return (
			error instanceof RecipeError &&
			error.statusCode !== undefined &&
			RECIPE_NOT_FOUND_STATUS_CODES.has(error.statusCode)
		);
	}

	public static async fromResponse(
		response: Response,
		method: string,
		path: string,
		message: string,
	): Promise<RecipeError> {
		const fitatuApiError = await createFitatuApiErrorDetails(response, { method, path });
		return new RecipeError(message, {
			statusCode: response.status,
			fitatuApiError,
		});
	}
}
