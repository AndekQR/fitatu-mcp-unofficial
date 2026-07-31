import { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";
import { ServiceError } from "../../services/ServiceError.ts";
import { FitatuClientErrorPublic } from "./FitatuClientErrorPublic.ts";

export class SafeLoggedError {
	public readonly name: string;
	public readonly message: string;
	public readonly stack?: string;
	public readonly cause?: SafeLoggedError;
	public readonly details?: Record<string, unknown>;

	private constructor(options: {
		readonly name: string;
		readonly message: string;
		readonly stack?: string;
		readonly cause?: SafeLoggedError;
		readonly details?: Record<string, unknown>;
	}) {
		this.name = options.name;
		this.message = options.message;
		this.stack = options.stack;
		this.cause = options.cause;
		this.details = options.details;
	}

	public static create(error: unknown, fallbackMessage: string): SafeLoggedError {
		if (!(error instanceof Error)) {
			return new SafeLoggedError({
				name: "UnknownError",
				message: fallbackMessage,
			});
		}

		const message =
			error instanceof FitatuClientError || error instanceof ServiceError ? error.message : fallbackMessage;
		return new SafeLoggedError({
			name: error.name,
			message,
			stack: safeStack(error, message),
			cause:
				error.cause instanceof Error ? SafeLoggedError.create(error.cause, "Redacted error cause") : undefined,
			details:
				error instanceof FitatuClientError
					? { ...new FitatuClientErrorPublic(error) }
					: error instanceof ServiceError
						? { kind: error.kind, code: error.code }
						: undefined,
		});
	}
}

function safeStack(error: Error, safeMessage: string): string | undefined {
	const frames = error.stack?.split("\n").slice(1);
	return frames && frames.length > 0 ? [`${error.name}: ${safeMessage}`, ...frames].join("\n") : undefined;
}
