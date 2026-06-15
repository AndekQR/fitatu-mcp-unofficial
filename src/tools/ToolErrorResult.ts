import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { FitatuAuthError } from "../api/auth/FitatuAuthError.ts";
import { DayPlanError } from "../api/dayPlan/DayPlanError.ts";
import { getFitatuApiErrors, isErrorWithFitatuApiDetails } from "../api/fitatuApiClientBase/FitatuApiError.ts";
import { FoodSearchError } from "../api/foodSearch/FoodSearchError.ts";
import { FitatuUserError } from "../api/users/FitatuUserError.ts";
import { createErrorResult } from "../lib/utils.ts";
import { logger } from "../logger.ts";

export function createToolErrorResult(
	toolName: string,
	fallbackMessage: string,
	error: unknown,
): CallToolResult {
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
	const fitatuApiErrors = getFitatuApiErrors(error);
	const statusCode = isErrorWithFitatuApiDetails(error) ? error.statusCode : undefined;
	const response: Record<string, unknown> = {
		status: "error",
		toolName,
		errorName,
		message,
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

function isKnownToolError(error: unknown): error is Error {
	return (
		error instanceof FitatuAuthError ||
		error instanceof DayPlanError ||
		error instanceof FoodSearchError ||
		error instanceof FitatuUserError
	);
}

function firstStatusCode(errorResponse: Record<string, unknown>): number | undefined {
	const single = errorResponse.fitatuApiError;
	if (isRecord(single) && typeof single.statusCode === "number") {
		return single.statusCode;
	}

	const many = errorResponse.fitatuApiErrors;
	if (Array.isArray(many)) {
		const first = many.find(isRecord);
		return typeof first?.statusCode === "number" ? first.statusCode : undefined;
	}

	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
