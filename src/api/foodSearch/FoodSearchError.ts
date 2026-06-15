export class FoodSearchError extends Error {
	public readonly statusCode?: number;

	public constructor(message: string, options: { statusCode?: number } = {}) {
		super(message);
		this.name = "FoodSearchError";
		this.statusCode = options.statusCode;
	}
}
