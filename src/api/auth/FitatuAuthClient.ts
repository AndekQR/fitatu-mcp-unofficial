import { getFitatuPassword, getFitatuUsername } from "../../config.ts";
import { FitatuApiClientBase } from "../fitatuApiClientBase/FitatuApiClientBase.ts";
import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthClientOptions } from "./FitatuAuthClientOptions.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";
import { FitatuLoginResponse } from "./FitatuLoginResponse.ts";
import type { FitatuLoginRequestBody } from "./FitatuLoginRequestBody.ts";

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
		});

		if (!response.ok) {
			throw new FitatuAuthError("Fitatu login failed", {
				statusCode: response.status,
			});
		}

		return FitatuLoginResponse.fromApiResponse(await response.json()).toSession();
	}
}

function defaultCredentialsProvider(): FitatuCredentials {
	return {
		username: getFitatuUsername(),
		password: getFitatuPassword(),
	};
}
