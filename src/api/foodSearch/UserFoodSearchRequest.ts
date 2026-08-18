export class UserFoodSearchRequest {
	public readonly userId: string;
	public readonly phrase: string;
	public readonly date: string;
	public readonly limit: number;

	public constructor(userId: string, phrase: string, date: string, limit: number) {
		this.userId = userId;
		this.phrase = phrase;
		this.date = date;
		this.limit = limit;
	}
}
