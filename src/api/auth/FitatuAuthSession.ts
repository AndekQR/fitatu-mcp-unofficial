export interface FitatuAuthSession {
	readonly token: string;
	readonly refreshToken?: string;
	readonly fitatuUserId: string;
}
