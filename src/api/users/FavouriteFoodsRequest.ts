export class FavouriteFoodsRequest {
	public readonly userId: string;
	public readonly limit: number;
	public readonly phrase?: string;

	public constructor(userId: string, limit: number, phrase?: string) {
		this.userId = userId;
		this.limit = limit;
		this.phrase = phrase;
	}
}
