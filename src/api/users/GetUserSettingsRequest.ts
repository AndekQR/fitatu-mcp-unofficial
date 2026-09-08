export class GetUserSettingsRequest {
	public readonly userId: string;
	public readonly date: string;

	public constructor(userId: string, date: string) {
		this.userId = userId;
		this.date = date;
	}
}
