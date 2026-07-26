import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
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
			throw new FitatuResponseDecodeError("Refresh response was not a valid JSON object");
		}

		const token = StringUtils.firstNonEmptyString(data.token, data.access_token);
		if (!token) {
			throw new FitatuResponseDecodeError("Refresh response did not contain an access token");
		}

		const refreshToken = parseOptionalRefreshToken(data.refresh_token, data.refreshToken);

		return new FitatuRefreshResponseData(token, refreshToken);
	}

	public toSession(previousSession: FitatuAuthSession): FitatuAuthSession {
		return {
			token: this.token,
			refreshToken: this.refreshToken ?? previousSession.refreshToken,
			fitatuUserId: previousSession.fitatuUserId,
		};
	}
}

function parseOptionalRefreshToken(...values: readonly unknown[]): string | undefined {
	if (values.every((value) => value === null || value === undefined)) {
		return undefined;
	}

	const refreshToken = StringUtils.firstNonEmptyString(...values);
	if (!refreshToken) {
		throw new FitatuResponseDecodeError("Refresh response refresh token must be a non-empty string");
	}

	return refreshToken;
}
