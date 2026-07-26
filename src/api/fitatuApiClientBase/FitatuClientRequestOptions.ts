import type { FitatuClientOperation } from "./FitatuClientOperations.ts";
import type { FitatuApiRequestOptions } from "./FitatuApiRequestOptions.ts";

export class FitatuClientRequestOptions implements FitatuApiRequestOptions {
	public readonly operation: FitatuClientOperation;
	public readonly method: string;
	public readonly path: string;
	public readonly endpointTemplate: string;
	public readonly failureMessage: string;
	public readonly query?: FitatuApiRequestOptions["query"];
	public readonly headers?: FitatuApiRequestOptions["headers"];
	public readonly body?: string | null;
	public readonly allowAuthenticationRefresh?: boolean;

	public constructor(options: FitatuClientRequestOptions) {
		this.operation = options.operation;
		this.method = options.method;
		this.path = options.path;
		this.endpointTemplate = options.endpointTemplate;
		this.failureMessage = options.failureMessage;
		this.query = options.query;
		this.headers = options.headers;
		this.body = options.body;
		this.allowAuthenticationRefresh = options.allowAuthenticationRefresh;
	}
}
