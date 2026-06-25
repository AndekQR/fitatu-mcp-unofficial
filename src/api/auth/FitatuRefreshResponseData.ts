import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";

interface FitatuRefreshApiResponseData {
	readonly token?: unknown;
	readonly access_token?: unknown;
	readonly refresh_token?: unknown;
	readonly refreshToken?: unknown;
}

export class FitatuRefreshResponseData {
	private readonly token: string;
	private readonly refreshToken?: string;

	private constructor(token: string, refreshToken?: string) {
		this.token = token;
		this.refreshToken = refreshToken;
	}

	public static fromApiResponse(data: unknown): FitatuRefreshResponseData {
		if (!isRefreshApiResponseData(data)) {
			throw new FitatuAuthError("Refresh response was not a valid JSON object");
		}

		const token = firstString(data.token, data.access_token);
		if (!token) {
			throw new FitatuAuthError("Refresh response did not contain an access token");
		}

		return new FitatuRefreshResponseData(token, firstString(data.refresh_token, data.refreshToken));
	}

	public toSession(previousSession: FitatuAuthSession): FitatuAuthSession {
		return {
			token: this.token,
			refreshToken: this.refreshToken ?? previousSession.refreshToken,
			fitatuUserId: previousSession.fitatuUserId,
		};
	}
}

function isRefreshApiResponseData(data: unknown): data is FitatuRefreshApiResponseData {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}

function firstString(...values: readonly unknown[]): string | undefined {
	return values.find((value): value is string => {
		return typeof value === "string" && value.trim().length > 0;
	});
}
