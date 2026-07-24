import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";

export class FitatuLoginResponse {
	public readonly token: string;
	public readonly refreshToken?: string;

	private constructor(token: string, refreshToken?: string) {
		this.token = token;
		this.refreshToken = refreshToken;
	}

	public static fromApiResponse(data: unknown): FitatuLoginResponse {
		if (!ObjectUtils.isRecord(data)) {
			throw new FitatuAuthError("Login response was not a valid JSON object");
		}

		const token = StringUtils.parseFirstNonEmptyString(
			[data.token, data.access_token],
			"Login response did not contain an access token",
		);

		return new FitatuLoginResponse(
			token,
			StringUtils.parseOptionalFirstNonEmptyString(
				[data.refresh_token, data.refreshToken],
				"Login response refresh token must be a non-empty string",
			),
		);
	}

	public toSession(): FitatuAuthSession {
		const fitatuUserId = extractUserIdFromJwt(this.token);
		if (!fitatuUserId) {
			throw new FitatuAuthError("Login token did not contain a Fitatu user id");
		}

		return {
			token: this.token,
			...(this.refreshToken ? { refreshToken: this.refreshToken } : {}),
			fitatuUserId,
		};
	}
}

function extractUserIdFromJwt(token: string): string | undefined {
	const [, encodedPayload] = token.split(".");
	if (!encodedPayload) {
		return undefined;
	}

	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(decodeBase64Url(encodedPayload)) as Record<string, unknown>;
	} catch {
		return undefined;
	}

	return StringUtils.parseFirstNonEmptyString(
		[payload.user_id, payload.uid, payload.id, payload.sub],
		"Login token did not contain a Fitatu user id",
	);
}

function decodeBase64Url(value: string): string {
	const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	return Buffer.from(padded, "base64").toString("utf-8");
}
