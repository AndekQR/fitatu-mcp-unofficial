export interface GetDayRequest {
	readonly userId: string;
	readonly date: string;
	readonly withRating?: boolean;
}
