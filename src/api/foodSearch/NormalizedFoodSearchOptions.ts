export class NormalizedFoodSearchOptions {
	public readonly queries: readonly string[];
	public readonly date: string;
	public readonly locale: string;
	public readonly limit: number;
	public readonly includeUserFood: boolean;
	public readonly includePublicFood: boolean;
	public readonly includeDetails: boolean;
	public readonly detailsLimit: number;

	public constructor(
		queries: readonly string[],
		date: string,
		locale: string,
		limit: number,
		includeUserFood: boolean,
		includePublicFood: boolean,
		includeDetails: boolean,
		detailsLimit: number,
	) {
		this.queries = queries;
		this.date = date;
		this.locale = locale;
		this.limit = limit;
		this.includeUserFood = includeUserFood;
		this.includePublicFood = includePublicFood;
		this.includeDetails = includeDetails;
		this.detailsLimit = detailsLimit;
	}
}
