import { ObjectUtils } from "../../shared/ObjectUtils.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuResponseDecodeError } from "../fitatuApiClientBase/FitatuResponseDecodeError.ts";
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
			throw new FitatuResponseDecodeError("Login response was not a valid JSON object");
		}

		const token = StringUtils.firstNonEmptyString(data.token, data.access_token);
		if (!token) {
			throw new FitatuResponseDecodeError("Login response did not contain an access token");
		}

		const refreshToken = parseOptionalRefreshToken(data.refresh_token, data.refreshToken);

		return new FitatuLoginResponse(token, refreshToken);
	}

	public toSession(): FitatuAuthSession {
		const fitatuUserId = extractUserIdFromJwt(this.token);
		if (!fitatuUserId) {
			throw new FitatuResponseDecodeError("Login token did not contain a Fitatu user id");
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

	return StringUtils.firstNonEmptyString(payload.user_id, payload.uid, payload.id, payload.sub);
}

function decodeBase64Url(value: string): string {
	const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
	return Buffer.from(padded, "base64").toString("utf-8");
}

function parseOptionalRefreshToken(...values: readonly unknown[]): string | undefined {
	if (values.every((value) => value === null || value === undefined)) {
		return undefined;
	}

	const refreshToken = StringUtils.firstNonEmptyString(...values);
	if (!refreshToken) {
		throw new FitatuResponseDecodeError("Login response refresh token must be a non-empty string");
	}

	return refreshToken;
}
