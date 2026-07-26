import { FitatuClientRequestOptions } from "./FitatuClientRequestOptions.ts";

export class FitatuJsonRequestOptions<T> extends FitatuClientRequestOptions {
	public readonly decoder: (data: unknown) => T;
	public readonly invalidResponseMessage?: string;

	public constructor(options: FitatuJsonRequestOptions<T>) {
		super(options);
		this.decoder = options.decoder;
		this.invalidResponseMessage = options.invalidResponseMessage;
	}
}
