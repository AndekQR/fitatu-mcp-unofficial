export class FitatuAuthSession {
	public readonly token: string;
	public readonly refreshToken?: string;
	public readonly fitatuUserId: string;

	public constructor(token: string, fitatuUserId: string, refreshToken?: string) {
		this.token = token;
		this.fitatuUserId = fitatuUserId;
		this.refreshToken = refreshToken;
	}
}
