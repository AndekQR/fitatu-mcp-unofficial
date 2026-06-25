import { getFitatuPassword, getFitatuUsername } from "../../config.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { createFitatuApiErrorDetails, type FitatuApiErrorDetails } from "../fitatuApiClientBase/FitatuApiError.ts";
import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthClientOptions } from "./FitatuAuthClientOptions.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";
import { FitatuLoginResponse } from "./FitatuLoginResponse.ts";
import type { FitatuLoginRequestBody } from "./FitatuLoginRequestBody.ts";
import { FitatuRefreshResponseData } from "./FitatuRefreshResponseData.ts";

export class FitatuAuthClient extends FitatuApiClientBase {
	private static instance: FitatuAuthClient | undefined;

	private readonly credentialsProvider: () => FitatuCredentials;
	private session: FitatuAuthSession | undefined;

	private constructor(options: FitatuAuthClientOptions = {}) {
		super(options);
		this.credentialsProvider = options.credentialsProvider ?? defaultCredentialsProvider;
	}

	public static getInstance(options: FitatuAuthClientOptions = {}): FitatuAuthClient {
		if (!FitatuAuthClient.instance) {
			FitatuAuthClient.instance = new FitatuAuthClient(options);
		}

		return FitatuAuthClient.instance;
	}

	public async getSession(): Promise<FitatuAuthSession> {
		if (this.session) {
			return this.session;
		}

		this.session = await this.login();
		return this.session;
	}

	public clearSession(): void {
		this.session = undefined;
	}

	public async refreshSession(): Promise<FitatuAuthSession> {
		const refreshToken = nonEmptyString(this.session?.refreshToken);
		if (!refreshToken) {
			this.clearSession();
			throw new FitatuAuthError("Fitatu refresh token is missing");
		}

		const errors: FitatuApiErrorDetails[] = [];
		for (const body of this.createRefreshRequestBodies(refreshToken)) {
			const response = await this.fetchFitatuApi({
				method: "POST",
				path: "/token/refresh",
				body: JSON.stringify(body),
				allowAuthenticationRefresh: false,
			});

			if (!response.ok) {
				errors.push(await createFitatuApiErrorDetails(response, { method: "POST", path: "/token/refresh" }));
				continue;
			}

			try {
				this.session = FitatuRefreshResponseData.fromApiResponse(await response.json()).toSession(this.session);
				return this.session;
			} catch (error) {
				this.clearSession();
				if (error instanceof FitatuAuthError) {
					throw error;
				}

				throw new FitatuAuthError("Fitatu refresh response was invalid");
			}
		}

		this.clearSession();
		throw new FitatuAuthError("Fitatu token refresh failed", {
			statusCode: errors.at(-1)?.statusCode,
			fitatuApiErrors: errors,
		});
	}

	private async login(): Promise<FitatuAuthSession> {
		const credentials = this.credentialsProvider();
		const body: FitatuLoginRequestBody = {
			_username: credentials.username,
			_password: credentials.password,
		};

		const response = await this.fetchFitatuApi({
			method: "POST",
			path: "/login",
			body: JSON.stringify(body),
			allowAuthenticationRefresh: false,
		});

		if (!response.ok) {
			const fitatuApiError = await createFitatuApiErrorDetails(response, { method: "POST", path: "/login" });
			throw new FitatuAuthError("Fitatu login failed", {
				statusCode: response.status,
				fitatuApiError,
			});
		}

		return FitatuLoginResponse.fromApiResponse(await response.json()).toSession();
	}

	private createRefreshRequestBodies(refreshToken: string): readonly Record<string, string>[] {
		return [{ refresh_token: refreshToken }, { refreshToken }, { token: refreshToken }];
	}
}

function defaultCredentialsProvider(): FitatuCredentials {
	return {
		username: getFitatuUsername(),
		password: getFitatuPassword(),
	};
}

function nonEmptyString(value: string | null | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
