import { StringUtils } from "../../shared/StringUtils.ts";
import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";
import {
	DEFAULT_APP_LOCALE,
	DEFAULT_APP_TIMEZONE,
	DEFAULT_FITATU_API_BASE_URL,
	DEFAULT_FITATU_HEADERS,
	DEFAULT_FITATU_MOBILE_CLIENT_PROFILE,
} from "./FitatuApiDefaults.ts";
import { FitatuApiClientBaseOptions } from "./FitatuApiClientBaseOptions.ts";
import type { FitatuApiRequestOptions } from "./FitatuApiRequestOptions.ts";
import type { FitatuRequestFailure } from "./FitatuClientFailure.ts";
import { FitatuClientError } from "./FitatuClientError.ts";
import type { FitatuClientRequestOptions } from "./FitatuClientRequestOptions.ts";
import type { FitatuJsonRequestOptions } from "./FitatuJsonRequestOptions.ts";
import type { FitatuRequestContext } from "./FitatuRequestContext.ts";
import { FitatuResponseDecodeError } from "./FitatuResponseDecodeError.ts";

export abstract class FitatuApiClientBase {
	protected readonly V3_ACCEPT_HEADER = "application/json; version=v3";

	protected readonly fetchFn: typeof fetch;

	private readonly fallbackBaseUrl: string;
	private readonly hasExplicitBaseUrl: boolean;
	private readonly authClient: FitatuApiClientBaseOptions["authClient"];
	private readonly userClient: FitatuApiClientBaseOptions["userClient"];
	private readonly mobileClientProfile;

	protected constructor(options: FitatuApiClientBaseOptions = {}) {
		const resolvedOptions = new FitatuApiClientBaseOptions(options);
		this.fallbackBaseUrl = normalizeBaseUrl(resolvedOptions.baseUrl ?? DEFAULT_FITATU_API_BASE_URL);
		this.hasExplicitBaseUrl = Boolean(resolvedOptions.baseUrl);
		this.fetchFn = resolvedOptions.fetchFn ?? fetch;
		this.authClient = resolvedOptions.authClient;
		this.userClient = resolvedOptions.userClient;
		this.mobileClientProfile = resolvedOptions.mobileClientProfile ?? DEFAULT_FITATU_MOBILE_CLIENT_PROFILE;
	}

	public async getContextUserId(userId?: string): Promise<string | undefined> {
		const [session, user] = await Promise.all([
			this.getOptionalAuthSession(),
			this.getOptionalCurrentUserProfile(),
		]);

		return this.resolveContextUserId(userId, user, session);
	}

	protected async performCallout<T>(options: FitatuJsonRequestOptions<T>): Promise<T> {
		const { response, attempts } = await this.performResponseCallout(options);
		return this.decodeJsonResponse(response, options, attempts);
	}

	protected async getContextSearchLocale(): Promise<string> {
		const user = await this.getOptionalCurrentUserProfile();
		return StringUtils.firstNonEmptyString(user?.searchLocale, user?.locale) ?? DEFAULT_APP_LOCALE;
	}

	protected async createRequestContext(options: FitatuApiRequestOptions): Promise<FitatuRequestContext> {
		const [session, user] = await Promise.all([
			this.getOptionalAuthSession(),
			this.getOptionalCurrentUserProfile(),
		]);
		const userId = this.resolveContextUserId(undefined, user, session);
		const baseUrl = this.resolveBaseUrl(user);

		return {
			url: createUrl(baseUrl, options.path, options.query),
			headers: {
				...this.createDefaultHeaders(user, userId, session?.token),
				...headersToRecord(options.headers),
			},
			...(user ? { user } : {}),
		};
	}

	private async decodeJsonResponse<T>(
		response: Response,
		options: FitatuJsonRequestOptions<T>,
		attempts: readonly FitatuRequestFailure[],
	): Promise<T> {
		let data: unknown;

		try {
			const text = await response.text();
			data = text.trim() ? JSON.parse(text) : null;
		} catch (error) {
			if (!(error instanceof SyntaxError)) {
				throw error;
			}

			throw this.createInvalidResponseError(options, error, attempts);
		}

		try {
			return options.decoder(data);
		} catch (error) {
			if (error instanceof FitatuClientError) {
				throw error;
			}
			if (!(error instanceof FitatuResponseDecodeError)) {
				throw error;
			}

			throw this.createInvalidResponseError(options, error, attempts);
		}
	}

	private createInvalidResponseError<T>(
		options: FitatuJsonRequestOptions<T>,
		cause: unknown,
		attempts: readonly FitatuRequestFailure[],
	): FitatuClientError {
		return FitatuClientError.invalidResponse({
			message: options.invalidResponseMessage ?? options.failureMessage,
			operation: options.operation,
			method: options.method,
			endpointTemplate: options.endpointTemplate,
			cause,
			attempts,
		});
	}

	private sendHttpRequest(context: FitatuRequestContext, options: FitatuApiRequestOptions): Promise<Response> {
		return this.fetchFn(context.url, {
			method: options.method,
			headers: context.headers,
			...(options.body !== undefined ? { body: options.body } : {}),
		});
	}

	private async performResponseCallout(
		options: FitatuClientRequestOptions,
	): Promise<{ readonly response: Response; readonly attempts: readonly FitatuRequestFailure[] }> {
		const firstResponse = await this.sendHttpRequestWithTransportErrorMapping(options);

		if (firstResponse.status !== 401 || !this.canRefreshAuthentication(options)) {
			return {
				response: await this.requireSuccessfulResponse(firstResponse, options),
				attempts: [],
			};
		}

		const firstError = await FitatuClientError.http({
			message: options.failureMessage,
			operation: options.operation,
			method: options.method,
			endpointTemplate: options.endpointTemplate,
			response: firstResponse,
		});
		const attempts = [firstError.failure];
		try {
			await this.refreshAuthenticationContext();
		} catch (error) {
			if (error instanceof FitatuClientError) {
				throw error.withAttempts([...attempts, ...error.attempts]);
			}
			throw error;
		}

		const secondResponse = await this.sendHttpRequestWithTransportErrorMapping(options, attempts);
		return {
			response: await this.requireSuccessfulResponse(secondResponse, options, attempts),
			attempts,
		};
	}

	private async sendHttpRequestWithTransportErrorMapping(
		options: FitatuClientRequestOptions,
		attempts: readonly FitatuRequestFailure[] = [],
	): Promise<Response> {
		const context = await this.createRequestContext(options);

		try {
			return await this.sendHttpRequest(context, options);
		} catch (error) {
			if (!isRecognizedTransportError(error)) {
				throw error;
			}

			throw FitatuClientError.transport({
				message: options.failureMessage,
				operation: options.operation,
				method: options.method,
				endpointTemplate: options.endpointTemplate,
				error,
				attempts,
			});
		}
	}

	private async requireSuccessfulResponse(
		response: Response,
		options: FitatuClientRequestOptions,
		attempts: readonly FitatuRequestFailure[] = [],
	): Promise<Response> {
		if (response.ok) {
			return response;
		}

		throw await FitatuClientError.http({
			message: options.failureMessage,
			operation: options.operation,
			method: options.method,
			endpointTemplate: options.endpointTemplate,
			response,
			attempts,
		});
	}

	private resolveContextUserId(
		userId: string | undefined,
		user: FitatuUserProfile | undefined,
		session: FitatuAuthSession | undefined,
	): string | undefined {
		return StringUtils.firstNonEmptyString(userId, user?.id, session?.fitatuUserId);
	}

	private async getOptionalAuthSession(): Promise<FitatuAuthSession | undefined> {
		if (!this.authClient) {
			return undefined;
		}

		return this.authClient.getSession();
	}

	private async getOptionalCurrentUserProfile(): Promise<FitatuUserProfile | undefined> {
		if (!this.userClient) {
			return undefined;
		}

		return this.userClient.getCurrentUser();
	}

	private canRefreshAuthentication(options: FitatuApiRequestOptions): boolean {
		return options.allowAuthenticationRefresh !== false && Boolean(this.authClient);
	}

	private async refreshAuthenticationContext(): Promise<void> {
		await this.authClient?.refreshSession();
		await this.userClient?.clearUserCache();
	}

	private resolveBaseUrl(user?: FitatuUserProfile): string {
		if (this.hasExplicitBaseUrl || !user?.locale) {
			return this.fallbackBaseUrl;
		}

		return `https://${toLocaleSegment(user.locale)}.fitatu.com/api`;
	}

	private createDefaultHeaders(
		user: FitatuUserProfile | undefined,
		clusterUserId: string | undefined,
		sessionToken: string | undefined,
	): Record<string, string> {
		const appLocale = StringUtils.firstNonEmptyString(user?.locale) ?? DEFAULT_APP_LOCALE;
		const searchLocale = StringUtils.firstNonEmptyString(user?.searchLocale, user?.locale);
		const storageLocale = StringUtils.firstNonEmptyString(user?.storageLocale, user?.locale);
		const timezone = StringUtils.firstNonEmptyString(user?.timezone) ?? DEFAULT_APP_TIMEZONE;

		return filterHeaders({
			...DEFAULT_FITATU_HEADERS,
			...this.mobileClientProfile.toHeaders(),
			"api-cluster": this.createApiClusterHeaderValue(clusterUserId, user),
			"app-storagelocale": storageLocale ?? DEFAULT_APP_LOCALE,
			"app-timezone": timezone,
			"app-searchlocale": searchLocale ?? DEFAULT_APP_LOCALE,
			"app-locale": appLocale,
			authorization: this.createAuthorizationHeaderValue(sessionToken),
		});
	}

	private createAuthorizationHeaderValue(sessionToken: string | undefined): string | undefined {
		const token = StringUtils.firstNonEmptyString(sessionToken);
		if (!token) {
			return undefined;
		}

		return `Bearer ${token}`;
	}

	private createApiClusterHeaderValue(userId: string | undefined, user?: FitatuUserProfile): string | undefined {
		const normalizedUserId = StringUtils.firstNonEmptyString(userId);
		if (!normalizedUserId) {
			return undefined;
		}

		const localeSegment = toLocaleSegment(user?.locale ?? DEFAULT_APP_LOCALE);
		return `dart-${localeSegment}${normalizedUserId}`;
	}
}

function headersToRecord(headers: Record<string, string | null | undefined> | undefined): Record<string, string> {
	if (!headers) {
		return {};
	}

	return filterHeaders(headers);
}

function filterHeaders(headers: Record<string, string | null | undefined>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(headers).flatMap(([name, value]) => {
			const headerValue = StringUtils.firstNonEmptyString(value);
			return headerValue ? [[name, headerValue]] : [];
		}),
	);
}

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
	return path.startsWith("/") ? path : `/${path}`;
}

function createUrl(baseUrl: string, path: string, query: FitatuApiRequestOptions["query"] | undefined): string {
	const url = new URL(`${baseUrl}${normalizePath(path)}`);

	for (const [name, value] of Object.entries(query ?? {})) {
		if (value === null || value === undefined) {
			continue;
		}

		if (Array.isArray(value)) {
			for (const item of value) {
				url.searchParams.append(name, String(item));
			}
			continue;
		}

		url.searchParams.set(name, String(value));
	}

	return url.toString();
}

function toLocaleSegment(locale: string): string {
	return locale.replaceAll("_", "-").toLowerCase();
}

function isRecognizedTransportError(error: unknown): error is Error {
	return (
		error instanceof TypeError ||
		(error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError"))
	);
}
