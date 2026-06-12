import { getFitatuPassword, getFitatuUsername } from "../../config.ts";
import { FitatuAuthError } from "./FitatuAuthError.ts";
import type { FitatuAuthClientOptions } from "./FitatuAuthClientOptions.ts";
import type { FitatuAuthSession } from "./FitatuAuthSession.ts";
import type { FitatuCredentials } from "./FitatuCredentials.ts";
import { FitatuLoginResponse } from "./FitatuLoginResponse.ts";
import type { FitatuLoginRequestBody } from "./FitatuLoginRequestBody.ts";

const DEFAULT_FITATU_API_BASE_URL = "https://en-gb.fitatu.com/api";

const DEFAULT_LOGIN_HEADERS = {
  "user-agent": "Dart/3.9 (dart:io)",
  "app-storagelocale": "en_GB",
  "accept-encoding": "gzip",
  "content-type": "application/json;charset=UTF-8",
  "app-os": "ANDROID",
  "app-timezone": "Europe/Warsaw",
  "app-searchlocale": "en_GB",
  "api-secret": "PYRXtfs88UDJMuCCrNpLV",
  "api-cluster": "dart - -",
  "app-locale": "en_GB",
  "app-uuid": "64c2d1b0-c8ad-11e8-8956-0242ac120008",
  "app-version": "4.14.1",
  "api-apk-uuid": "CP21.260330.012",
  "api-key": "FITATU-MOBILE-APP",
} as const;

export class FitatuAuthClient {
  private static instance: FitatuAuthClient | undefined;

  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly credentialsProvider: () => FitatuCredentials;
  private session: FitatuAuthSession | undefined;
  private pendingLogin: Promise<FitatuAuthSession> | undefined;

  private constructor(options: FitatuAuthClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_FITATU_API_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.fetchFn = options.fetchFn ?? fetch;
    this.credentialsProvider =
      options.credentialsProvider ?? defaultCredentialsProvider;
  }

  public static getInstance(
    options: FitatuAuthClientOptions = {},
  ): FitatuAuthClient {
    if (!FitatuAuthClient.instance) {
      FitatuAuthClient.instance = new FitatuAuthClient(options);
    }

    return FitatuAuthClient.instance;
  }

  public async getSession(): Promise<FitatuAuthSession> {
    if (this.session) {
      return this.session;
    }

    if (!this.pendingLogin) {
      this.pendingLogin = this.login();
    }

    try {
      this.session = await this.pendingLogin;
      return this.session;
    } finally {
      this.pendingLogin = undefined;
    }
  }

  public clearSession(): void {
    this.session = undefined;
    this.pendingLogin = undefined;
  }

  private async login(): Promise<FitatuAuthSession> {
    const credentials = this.credentialsProvider();
    const body: FitatuLoginRequestBody = {
      _username: credentials.username,
      _password: credentials.password,
    };

    const response = await this.fetchFn(`${this.baseUrl}/login`, {
      method: "POST",
      headers: DEFAULT_LOGIN_HEADERS,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new FitatuAuthError("Fitatu login failed", {
        statusCode: response.status,
      });
    }

    return FitatuLoginResponse.fromApiResponse(
      await response.json(),
    ).toSession();
  }
}

function defaultCredentialsProvider(): FitatuCredentials {
  return {
    username: getFitatuUsername(),
    password: getFitatuPassword(),
  };
}
