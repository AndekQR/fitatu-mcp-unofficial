export class FitatuUserError extends Error {
	public readonly statusCode?: number;

	public constructor(message: string, options: { statusCode?: number } = {}) {
		super(message);
		this.name = "FitatuUserError";
		this.statusCode = options.statusCode;
	}
}
