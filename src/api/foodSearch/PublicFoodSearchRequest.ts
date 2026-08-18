export class PublicFoodSearchRequest {
	public readonly phrase: string;
	public readonly locale: string;
	public readonly limit: number;

	public constructor(phrase: string, locale: string, limit: number) {
		this.phrase = phrase;
		this.locale = locale;
		this.limit = limit;
	}
}
