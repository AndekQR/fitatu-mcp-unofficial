import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { FitatuAuthError } from "../../api/auth/FitatuAuthError.ts";
import { DayPlanError } from "../../api/dayPlan/DayPlanError.ts";
import { getFitatuApiErrors, isErrorWithFitatuApiDetails } from "../../api/fitatuApiClientBase/FitatuApiError.ts";
import { FoodSearchError } from "../../api/foodSearch/FoodSearchError.ts";
import { RecipeError } from "../../api/recipes/RecipeError.ts";
import { FitatuUserError } from "../../api/users/FitatuUserError.ts";
import { createErrorResult } from "./ToolResult.ts";
import { logger } from "../../logger.ts";

export function createToolErrorResult(toolName: string, fallbackMessage: string, error: unknown): CallToolResult {
	const errorResponse = toToolErrorResponse(toolName, fallbackMessage, error);

	logger.error(
		{
			toolName,
			errorName: errorResponse.errorName,
			statusCode: firstStatusCode(errorResponse),
		},
		"Tool execution failed",
	);

	return createErrorResult(errorResponse);
}

function toToolErrorResponse(toolName: string, fallbackMessage: string, error: unknown): Record<string, unknown> {
	const errorName = error instanceof Error ? error.name : "UnknownError";
	const message = isKnownToolError(error) ? error.message : fallbackMessage;
	const fitatuApiErrors = getFitatuApiErrors(error).map((details) =>
		error instanceof RecipeError ? sanitizeRecipeApiError(details) : details,
	);
	const statusCode = isErrorWithFitatuApiDetails(error) ? error.statusCode : undefined;
	const response: Record<string, unknown> = {
		status: "error",
		toolName,
		errorName,
		message,
		...(error instanceof RecipeError
			? {
					code: error.code,
					retryable: error.retryable,
					...(error.parameter ? { parameter: error.parameter } : {}),
				}
			: {}),
	};

	if (fitatuApiErrors.length === 1) {
		response.fitatuApiError = fitatuApiErrors[0];
	} else if (fitatuApiErrors.length > 1) {
		response.fitatuApiErrors = fitatuApiErrors;
	} else if (statusCode !== undefined) {
		response.fitatuApiError = { statusCode };
	}

	return response;
}

function sanitizeRecipeApiError(details: ReturnType<typeof getFitatuApiErrors>[number]) {
	return {
		...details,
		path: details.path
			.replace(/(\/recipes-and-user-action\/[^/]+)\/[^/?]+/, "$1/:userId")
			.replace(/(\/search\/food\/user)\/[^/?]+/, "$1/:userId"),
		upstreamMessage: null,
		responseSnippet: null,
	};
}

function isKnownToolError(error: unknown): error is Error {
	return (
		error instanceof FitatuAuthError ||
		error instanceof DayPlanError ||
		error instanceof FoodSearchError ||
		error instanceof RecipeError ||
		error instanceof FitatuUserError
	);
}

function firstStatusCode(errorResponse: Record<string, unknown>): number | undefined {
	const single = errorResponse.fitatuApiError;
	if (ObjectUtils.isRecord(single) && typeof single.statusCode === "number") {
		return single.statusCode;
	}

	const many = errorResponse.fitatuApiErrors;
	if (Array.isArray(many)) {
		const first = many.find(ObjectUtils.isRecord);
		return typeof first?.statusCode === "number" ? first.statusCode : undefined;
	}

	return undefined;
}
