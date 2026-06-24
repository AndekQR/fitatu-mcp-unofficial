import type { FitatuApiErrorDetails, FitatuApiErrorOptions } from "../fitatuApiClientBase/FitatuApiError.ts";

export class FitatuUserError extends Error {
	public readonly statusCode?: number;
	public readonly fitatuApiError?: FitatuApiErrorDetails;
	public readonly fitatuApiErrors?: readonly FitatuApiErrorDetails[];

	public constructor(message: string, options: FitatuApiErrorOptions = {}) {
		super(message);
		this.name = "FitatuUserError";
		this.statusCode = options.statusCode;
		this.fitatuApiError = options.fitatuApiError;
		this.fitatuApiErrors = options.fitatuApiErrors;
	}
}
