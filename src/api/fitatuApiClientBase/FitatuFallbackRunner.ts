import type { FitatuRequestFailure } from "./FitatuClientFailure.ts";
import { FitatuClientError } from "./FitatuClientError.ts";

export class FitatuFallbackRunner {
	public static async run<TVariant, TResult>(
		variants: readonly TVariant[],
		attempt: (variant: TVariant, index: number) => Promise<TResult>,
		shouldTryNext: (error: FitatuClientError, index: number) => boolean,
		beforeNextAttempt?: (error: FitatuClientError, index: number) => Promise<void> | void,
	): Promise<TResult> {
		if (variants.length === 0) {
			throw new Error("Fitatu fallback variants must not be empty");
		}

		const previousAttempts: FitatuRequestFailure[] = [];
		for (const [index, variant] of variants.entries()) {
			try {
				return await attempt(variant, index);
			} catch (error) {
				if (!(error instanceof FitatuClientError)) {
					throw error;
				}

				const hasNextVariant = index < variants.length - 1;
				if (hasNextVariant && shouldTryNext(error, index)) {
					previousAttempts.push(...requestFailuresFrom(error));
					await beforeNextAttempt?.(error, index);
					continue;
				}

				throw previousAttempts.length > 0
					? error.withAttempts([...previousAttempts, ...error.attempts])
					: error;
			}
		}

		throw new Error("Fitatu fallback variants were unexpectedly exhausted");
	}
}

function requestFailuresFrom(error: FitatuClientError): readonly FitatuRequestFailure[] {
	if (
		error.failure.kind !== "http" &&
		error.failure.kind !== "transport" &&
		error.failure.kind !== "invalidResponse"
	) {
		throw error;
	}

	return [...error.attempts, error.failure];
}
