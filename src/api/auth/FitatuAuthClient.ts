import { getFitatuPassword, getFitatuUsername } from "../../config.ts";
import { StringUtils } from "../../shared/StringUtils.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuClientError } from "../fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../fitatuApiClientBase/FitatuClientOperations.ts";
import { FitatuFallbackRunner } from "../fitatuApiClientBase/FitatuFallbackRunner.ts";
import type { FitatuAuthClientOptions } from "./FitatuAuthClientOptions.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";
import { FitatuLoginResponse } from "./FitatuLoginResponse.ts";
import type { FitatuLoginRequestBody } from "./FitatuLoginRequestBody.ts";
import { FitatuRefreshResponseData } from "./FitatuRefreshResponseData.ts";

const REFRESH_PAYLOAD_FALLBACK_STATUS_CODES = new Set([400, 401, 404, 415, 422]);

export class FitatuAuthClient extends FitatuApiClientBase {
	private static instance: FitatuAuthClient | undefined;

	private readonly credentialsProvider: () => FitatuCredentials;
	private session: FitatuAuthSession | undefined;
	private sessionPromise: Promise<FitatuAuthSession> | undefined;
	private sessionGeneration = 0;

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

		if (!this.sessionPromise) {
			this.sessionPromise = this.loginAndCache(this.sessionGeneration);
		}

		return this.sessionPromise;
	}

	public clearSession(): void {
		this.sessionGeneration += 1;
		this.session = undefined;
		this.sessionPromise = undefined;
	}

	public async refreshSession(): Promise<FitatuAuthSession> {
		const previousSession = this.session;
		if (!previousSession) {
			this.clearSession();
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.authRefresh,
				message: "Fitatu refresh token is missing",
			});
		}

		const refreshToken = StringUtils.firstNonEmptyString(previousSession.refreshToken);
		if (!refreshToken) {
			this.clearSession();
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.authRefresh,
				message: "Fitatu refresh token is missing",
			});
		}

		try {
			this.session = await this.refreshWithFallback(previousSession, refreshToken);
			return this.session;
		} catch (error) {
			this.clearSession();
			throw error;
		}
	}

	private async login(): Promise<FitatuAuthSession> {
		const credentials = this.credentialsProvider();
		const username = StringUtils.firstNonEmptyString(credentials.username);
		const password = StringUtils.firstNonEmptyString(credentials.password);
		if (!username || !password) {
			throw FitatuClientError.authentication({
				operation: FITATU_CLIENT_OPERATIONS.authLogin,
				message: "Fitatu credentials are missing",
			});
		}

		const body: FitatuLoginRequestBody = {
			_username: username,
			_password: password,
		};

		return this.requestJson({
			operation: FITATU_CLIENT_OPERATIONS.authLogin,
			method: "POST",
			path: "/login",
			endpointTemplate: "/login",
			failureMessage: "Fitatu login failed",
			invalidResponseMessage: "Fitatu login response was invalid",
			body: JSON.stringify(body),
			allowAuthenticationRefresh: false,
			decoder: (data) => FitatuLoginResponse.fromApiResponse(data).toSession(),
		});
	}

	private async loginAndCache(generation: number): Promise<FitatuAuthSession> {
		try {
			const session = await this.login();
			if (generation === this.sessionGeneration) {
				this.session = session;
			}
			return session;
		} finally {
			if (generation === this.sessionGeneration) {
				this.sessionPromise = undefined;
			}
		}
	}

	private createRefreshRequestBodies(refreshToken: string): readonly Record<string, string>[] {
		return [{ refresh_token: refreshToken }, { refreshToken }, { token: refreshToken }];
	}

	private async refreshWithFallback(
		previousSession: FitatuAuthSession,
		refreshToken: string,
	): Promise<FitatuAuthSession> {
		const requestBodies = this.createRefreshRequestBodies(refreshToken);
		return FitatuFallbackRunner.run(
			requestBodies,
			(body) =>
				this.requestJson({
					operation: FITATU_CLIENT_OPERATIONS.authRefresh,
					method: "POST",
					path: "/token/refresh",
					endpointTemplate: "/token/refresh",
					failureMessage: "Fitatu token refresh failed",
					invalidResponseMessage: "Fitatu refresh response was invalid",
					body: JSON.stringify(body),
					allowAuthenticationRefresh: false,
					decoder: (data) => FitatuRefreshResponseData.fromApiResponse(data).toSession(previousSession),
				}),
			isRefreshPayloadFallbackError,
		);
	}
}

function defaultCredentialsProvider(): FitatuCredentials {
	return {
		username: getFitatuUsername(),
		password: getFitatuPassword(),
	};
}

function isRefreshPayloadFallbackError(error: FitatuClientError): boolean {
	return error.failure.kind === "http" && REFRESH_PAYLOAD_FALLBACK_STATUS_CODES.has(error.failure.statusCode);
}
