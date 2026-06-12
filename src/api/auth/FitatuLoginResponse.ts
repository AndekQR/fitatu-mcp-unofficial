import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";

interface FitatuLoginResponseData {
  readonly token?: unknown;
  readonly access_token?: unknown;
  readonly refresh_token?: unknown;
  readonly refreshToken?: unknown;
}

export class FitatuLoginResponse {
  public readonly token: string;
  public readonly refreshToken?: string;

  private constructor(token: string, refreshToken?: string) {
    this.token = token;
    this.refreshToken = refreshToken;
  }

  public static fromApiResponse(data: unknown): FitatuLoginResponse {
    if (!isLoginResponseData(data)) {
      throw new FitatuAuthError("Login response was not a valid JSON object");
    }

    const token = firstString(data.token, data.access_token);
    if (!token) {
      throw new FitatuAuthError(
        "Login response did not contain an access token",
      );
    }

    return new FitatuLoginResponse(
      token,
      firstString(data.refresh_token, data.refreshToken),
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

function isLoginResponseData(data: unknown): data is FitatuLoginResponseData {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

function firstString(...values: readonly unknown[]): string | undefined {
  return values.find((value): value is string => {
    return typeof value === "string" && value.trim().length > 0;
  });
}

function extractUserIdFromJwt(token: string): string | undefined {
  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) {
    return undefined;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as Record<
      string,
      unknown
    >;

    return firstString(payload.user_id, payload.uid, payload.id, payload.sub);
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  return Buffer.from(padded, "base64").toString("utf-8");
}
