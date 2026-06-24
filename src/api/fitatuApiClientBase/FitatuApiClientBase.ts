import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";
import { DEFAULT_APP_LOCALE, DEFAULT_APP_TIMEZONE, DEFAULT_FITATU_API_BASE_URL, DEFAULT_FITATU_HEADERS } from "./FitatuApiDefaults.ts";
import type { FitatuApiClientBaseOptions } from "./FitatuApiClientBaseOptions.ts";
import type { FitatuApiRequestOptions } from "./FitatuApiRequestOptions.ts";
import type { FitatuRequestContext } from "./FitatuRequestContext.ts";

export abstract class FitatuApiClientBase {
	protected readonly V3_ACCEPT_HEADER = "application/json; version=v3";

	protected readonly fetchFn: typeof fetch;

	private readonly fallbackBaseUrl: string;
	private readonly hasExplicitBaseUrl: boolean;
	private readonly sessionProvider: FitatuApiClientBaseOptions["sessionProvider"];
	private readonly currentUserProvider: FitatuApiClientBaseOptions["currentUserProvider"];

	protected constructor(options: FitatuApiClientBaseOptions = {}) {
		this.fallbackBaseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_FITATU_API_BASE_URL);
		this.hasExplicitBaseUrl = Boolean(options.baseUrl);
		this.fetchFn = options.fetchFn ?? fetch;
		this.sessionProvider = options.sessionProvider;
		this.currentUserProvider = options.currentUserProvider;
	}

	protected async fetchFitatuApi(options: FitatuApiRequestOptions): Promise<Response> {
		const response = await this.fetchFitatuApiOnce(options);

		if (response.status !== 401 || !this.canRefreshAuthentication()) {
			return response;
		}

		await this.clearAuthenticationContext();
		return this.fetchFitatuApiOnce(options);
	}

	protected async getContextUserId(userId?: string): Promise<string | undefined> {
		const [session, user] = await Promise.all([this.getProvidedSession(), this.getProvidedCurrentUser()]);

		return this.resolveContextUserId(userId, user, session);
	}

	protected async createRequestContext(options: FitatuApiRequestOptions): Promise<FitatuRequestContext> {
		const [session, user] = await Promise.all([this.getProvidedSession(), this.getProvidedCurrentUser()]);
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

	private async fetchFitatuApiOnce(options: FitatuApiRequestOptions): Promise<Response> {
		const context = await this.createRequestContext(options);

		return this.fetchFn(context.url, {
			method: options.method,
			headers: context.headers,
			...(options.body !== undefined ? { body: options.body } : {}),
		});
	}

	private resolveContextUserId(
		userId: string | undefined,
		user: FitatuUserProfile | undefined,
		session: FitatuAuthSession | undefined,
	): string | undefined {
		return nonEmptyString(userId) ?? nonEmptyString(user?.id) ?? nonEmptyString(session?.fitatuUserId);
	}

	private async getProvidedSession(): Promise<FitatuAuthSession | undefined> {
		if (!this.sessionProvider) {
			return undefined;
		}

		return this.sessionProvider.getSession();
	}

	private async getProvidedCurrentUser(): Promise<FitatuUserProfile | undefined> {
		if (!this.currentUserProvider) {
			return undefined;
		}

		try {
			return await this.currentUserProvider.getCurrentUser();
		} catch {
			return undefined;
		}
	}

	private canRefreshAuthentication(): boolean {
		return Boolean(this.sessionProvider?.clearSession || this.currentUserProvider?.clearUserCache);
	}

	private async clearAuthenticationContext(): Promise<void> {
		await Promise.all([this.sessionProvider?.clearSession?.(), this.currentUserProvider?.clearUserCache?.()]);
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
		const appLocale = nonEmptyString(user?.locale) ?? DEFAULT_APP_LOCALE;
		const searchLocale = nonEmptyString(user?.searchLocale) ?? nonEmptyString(user?.locale);
		const storageLocale = nonEmptyString(user?.storageLocale) ?? nonEmptyString(user?.locale);
		const timezone = nonEmptyString(user?.timezone) ?? DEFAULT_APP_TIMEZONE;

		return filterHeaders({
			...DEFAULT_FITATU_HEADERS,
			"api-cluster": this.createApiCluster(clusterUserId, user),
			"app-storagelocale": storageLocale ?? DEFAULT_APP_LOCALE,
			"app-timezone": timezone,
			"app-searchlocale": searchLocale ?? DEFAULT_APP_LOCALE,
			"app-locale": appLocale,
			authorization: this.createAuthorizationValue(sessionToken),
		});
	}

	private createAuthorizationValue(sessionToken: string | undefined): string | undefined {
		const token = nonEmptyString(sessionToken);
		if (!token) {
			return undefined;
		}

		return `Bearer ${token}`;
	}

	private createApiCluster(userId: string | undefined, user?: FitatuUserProfile): string | undefined {
		const normalizedUserId = nonEmptyString(userId);
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
			const headerValue = nonEmptyString(value);
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

function nonEmptyString(value: string | null | undefined): string | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}
