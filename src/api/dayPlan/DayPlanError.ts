export class DayPlanError extends Error {
	public readonly statusCode?: number;

	public constructor(message: string, options: { statusCode?: number } = {}) {
		super(message);
		this.name = "DayPlanError";
		this.statusCode = options.statusCode;
	}
}
