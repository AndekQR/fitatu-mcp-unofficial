import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../../logger.ts";
import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { ServiceError } from "../../services/ServiceError.ts";
import { FitatuClientErrorPublic } from "./FitatuClientErrorPublic.ts";
import { SafeLoggedError } from "./SafeLoggedError.ts";
import { createErrorResult } from "./ToolResult.ts";

export class ToolErrorResult {
	public static create(toolName: string, fallbackMessage: string, error: unknown): CallToolResult {
		const publicError = this.toPublicError(fallbackMessage, error);

		logger.error(
			{
				toolName,
				errorName: error instanceof Error ? error.name : "UnknownError",
				error: SafeLoggedError.create(error, fallbackMessage),
				errorSource: publicError.source,
				statusCode:
					error instanceof FitatuClientError && error.failure.kind === "http"
						? error.failure.statusCode
						: undefined,
			},
			"Tool execution failed",
		);

		return createErrorResult({
			status: "error",
			toolName,
			error: publicError,
		});
	}

	private static toPublicError(fallbackMessage: string, error: unknown): Record<string, unknown> {
		if (error instanceof FitatuClientError) {
			return {
				source: "fitatuApi",
				...new FitatuClientErrorPublic(error),
			};
		}

		if (error instanceof ServiceError) {
			return {
				source: "service",
				name: error.name,
				message: error.message,
				kind: error.kind,
				code: error.code,
			};
		}

		return {
			source: "internal",
			name: error instanceof Error ? error.name : "UnknownError",
			message: fallbackMessage,
		};
	}
}
