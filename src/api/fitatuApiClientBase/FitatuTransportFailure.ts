export class FitatuTransportFailure {
	public readonly kind = "transport" as const;

	public readonly method: string;
	public readonly endpointTemplate: string;
	public readonly errorName: string;

	public constructor(options: {
		readonly method: string;
		readonly endpointTemplate: string;
		readonly errorName: string;
	}) {
		this.method = options.method;
		this.endpointTemplate = options.endpointTemplate;
		this.errorName = options.errorName;
	}
}
