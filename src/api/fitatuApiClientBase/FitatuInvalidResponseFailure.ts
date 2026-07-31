export class FitatuInvalidResponseFailure {
	public readonly kind = "invalidResponse" as const;

	public readonly method: string;
	public readonly endpointTemplate: string;

	public constructor(options: { readonly method: string; readonly endpointTemplate: string }) {
		this.method = options.method;
		this.endpointTemplate = options.endpointTemplate;
	}
}
