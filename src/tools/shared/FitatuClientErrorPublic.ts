import type { FitatuClientFailure, FitatuRequestFailure } from "../../api/fitatuApiClientBase/FitatuClientFailure.ts";
import type { FitatuClientOperation } from "../../api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FitatuClientError } from "../../api/fitatuApiClientBase/FitatuClientError.ts";

export class FitatuClientErrorPublic {
	public readonly name = "FitatuClientError";
	public readonly message: string;
	public readonly operation: FitatuClientOperation;
	public readonly failure: FitatuClientFailure;
	public readonly attempts: readonly FitatuRequestFailure[];

	public constructor(error: FitatuClientError) {
		this.message = error.message;
		this.operation = error.operation;
		this.failure = error.failure;
		this.attempts = error.attempts;
	}
}
