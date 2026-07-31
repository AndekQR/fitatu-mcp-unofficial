export class GetDayPlanOptions {
	public readonly date: string;
	public readonly userId?: string;
	public readonly withRating?: boolean;

	public constructor(date: string, userId?: string, withRating?: boolean) {
		this.date = date;
		this.userId = userId;
		this.withRating = withRating;
	}

	public static from(options: GetDayPlanOptions): GetDayPlanOptions {
		return new GetDayPlanOptions(options.date, options.userId, options.withRating);
	}
}
