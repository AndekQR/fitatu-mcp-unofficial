import { FitatuAuthenticationFailure } from "./FitatuAuthenticationFailure.ts";
import type { FitatuClientFailure, FitatuRequestFailure } from "./FitatuClientFailure.ts";
import type { FitatuClientOperation } from "./FitatuClientOperations.ts";
import { FitatuHttpFailure } from "./FitatuHttpFailure.ts";
import { FitatuInvalidRequestFailure } from "./FitatuInvalidRequestFailure.ts";
import { FitatuInvalidResponseFailure } from "./FitatuInvalidResponseFailure.ts";
import { FitatuTransportFailure } from "./FitatuTransportFailure.ts";

export class FitatuClientError<TFailure extends FitatuClientFailure = FitatuClientFailure> extends Error {
	public readonly operation: FitatuClientOperation;
	public readonly failure: TFailure;
	public readonly attempts: readonly FitatuRequestFailure[];

	private constructor(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
		readonly failure: TFailure;
		readonly attempts?: readonly FitatuRequestFailure[];
		readonly cause?: unknown;
	}) {
		super(options.message, options.cause === undefined ? undefined : { cause: options.cause });
		this.name = "FitatuClientError";
		this.operation = options.operation;
		this.failure = options.failure;
		this.attempts = [...(options.attempts ?? [])];
	}

	public static invalidRequest(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
	}): FitatuClientError<FitatuInvalidRequestFailure> {
		return new FitatuClientError({
			message: options.message,
			operation: options.operation,
			failure: new FitatuInvalidRequestFailure(),
		});
	}

	public static authentication(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
		readonly cause?: unknown;
	}): FitatuClientError<FitatuAuthenticationFailure> {
		return new FitatuClientError({
			message: options.message,
			operation: options.operation,
			failure: new FitatuAuthenticationFailure(),
			cause: options.cause,
		});
	}

	public static transport(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
		readonly method: string;
		readonly endpointTemplate: string;
		readonly error: Error;
		readonly attempts?: readonly FitatuRequestFailure[];
	}): FitatuClientError<FitatuTransportFailure> {
		return new FitatuClientError({
			message: options.message,
			operation: options.operation,
			failure: new FitatuTransportFailure({
				method: options.method,
				endpointTemplate: options.endpointTemplate,
				errorName: getSafeTransportErrorName(options.error),
			}),
			attempts: options.attempts,
			cause: options.error,
		});
	}

	public static async http(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
		readonly method: string;
		readonly endpointTemplate: string;
		readonly response: Response;
		readonly attempts?: readonly FitatuRequestFailure[];
	}): Promise<FitatuClientError<FitatuHttpFailure>> {
		return new FitatuClientError({
			message: options.message,
			operation: options.operation,
			failure: await FitatuHttpFailure.fromResponse(options),
			attempts: options.attempts,
		});
	}

	public static invalidResponse(options: {
		readonly message: string;
		readonly operation: FitatuClientOperation;
		readonly method: string;
		readonly endpointTemplate: string;
		readonly cause?: unknown;
		readonly attempts?: readonly FitatuRequestFailure[];
	}): FitatuClientError<FitatuInvalidResponseFailure> {
		return new FitatuClientError({
			message: options.message,
			operation: options.operation,
			failure: new FitatuInvalidResponseFailure({
				method: options.method,
				endpointTemplate: options.endpointTemplate,
			}),
			attempts: options.attempts,
			cause: options.cause,
		});
	}

	public withAttempts(
		attempts: readonly FitatuRequestFailure[],
		message = this.message,
	): FitatuClientError<TFailure> {
		return new FitatuClientError({
			message,
			operation: this.operation,
			failure: this.failure,
			attempts,
			cause: this.cause,
		});
	}
}

function getSafeTransportErrorName(error: Error): string {
	if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
		return error.name;
	}

	return error instanceof TypeError ? "TypeError" : "Error";
}
