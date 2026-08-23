export class PublicFoodSearchRequest {
	public readonly phrase: string;
	public readonly locale: string;
	public readonly limit: number;
	public readonly hasFilters?: boolean;

	public constructor(phrase: string, locale: string, limit: number, hasFilters?: boolean) {
		this.phrase = phrase;
		this.locale = locale;
		this.limit = limit;
		this.hasFilters = hasFilters;
	}
}
