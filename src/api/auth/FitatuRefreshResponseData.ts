import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";

export class FitatuRefreshResponseData {
	private readonly token: string;
	private readonly refreshToken?: string;

	private constructor(token: string, refreshToken?: string) {
		this.token = token;
		this.refreshToken = refreshToken;
	}

	public static fromApiResponse(data: unknown): FitatuRefreshResponseData {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuAuthError("Refresh response was not a valid JSON object");
		}

		const token = StringUtils.parseFirstNonEmptyString(
			[data.token, data.access_token],
			"Refresh response did not contain an access token",
		);

		return new FitatuRefreshResponseData(
			token,
			StringUtils.parseOptionalFirstNonEmptyString(
				[data.refresh_token, data.refreshToken],
				"Refresh response refresh token must be a non-empty string",
			),
		);
	}

	public toSession(previousSession: FitatuAuthSession): FitatuAuthSession {
		return {
			token: this.token,
			refreshToken: this.refreshToken ?? previousSession.refreshToken,
			fitatuUserId: previousSession.fitatuUserId,
		};
	}
}
