import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";
import {
	DEFAULT_APP_LOCALE,
	DEFAULT_APP_TIMEZONE,
	DEFAULT_FITATU_API_BASE_URL,
	DEFAULT_FITATU_HEADERS,
} from "./FitatuApiDefaults.ts";
import type { FitatuApiClientBaseOptions } from "./FitatuApiClientBaseOptions.ts";
import type { FitatuApiRequestOptions } from "./FitatuApiRequestOptions.ts";
import type { FitatuRequestContext } from "./FitatuRequestContext.ts";

interface FitatuAuthenticatedApiRequestOptions extends Omit<
	FitatuApiRequestOptions,
	"bootstrap"
> {
	readonly userId?: string;
}

interface FitatuApiRequestContextOptions extends FitatuApiRequestOptions {
	readonly apiClusterUserId?: string;
	readonly authorizationToken?: string;
	readonly contextUser?: FitatuUserProfile;
}

export abstract class FitatuApiClientBase {
	protected readonly fetchFn: typeof fetch;

	private readonly fallbackBaseUrl: string;
	private readonly hasExplicitBaseUrl: boolean;
	private readonly currentUserProvider:
		| (() => Promise<FitatuUserProfile | undefined>)
		| undefined;

	protected constructor(options: FitatuApiClientBaseOptions = {}) {
		this.fallbackBaseUrl = normalizeBaseUrl(
			options.baseUrl ?? DEFAULT_FITATU_API_BASE_URL,
		);
		this.hasExplicitBaseUrl = Boolean(options.baseUrl);
		this.fetchFn = options.fetchFn ?? fetch;
		this.currentUserProvider = options.currentUserProvider;
	}

	protected async fetchFitatuApi(
		options: FitatuApiRequestOptions,
	): Promise<Response> {
		const context = await this.createRequestContext(options);

		return this.fetchFn(context.url, {
			method: options.method,
			headers: context.headers,
			...(options.body !== undefined ? { body: options.body } : {}),
		});
	}

	protected async fetchAuthenticatedFitatuApi(
		options: FitatuAuthenticatedApiRequestOptions,
	): Promise<Response> {
		const [session, user] = await Promise.all([
			this.getAuthSession(),
			this.getCurrentUser(),
		]);
		const userId = this.resolveAuthenticatedUserId(
			options.userId,
			user,
			session,
		);

		const context = await this.createRequestContext({
			...options,
			contextUser: user,
			apiClusterUserId: userId,
			authorizationToken: session.token,
		});

		return this.fetchFn(context.url, {
			method: options.method,
			headers: context.headers,
			...(options.body !== undefined ? { body: options.body } : {}),
		});
	}

	protected async getAuthenticatedUserId(userId?: string): Promise<string> {
		const user = await this.getCurrentUser();
		const session = await this.getAuthSession();

		return this.resolveAuthenticatedUserId(userId, user, session);
	}

	protected async createRequestContext(
		options: FitatuApiRequestContextOptions,
	): Promise<FitatuRequestContext> {
		const user = options.bootstrap
			? undefined
			: (options.contextUser ?? (await this.getCurrentUser()));
		const baseUrl = this.resolveBaseUrl(user);

		return {
			url: createUrl(baseUrl, options.path, options.query),
			headers: {
				...this.createDefaultHeaders(
					user,
					options.apiClusterUserId,
					options.authorizationToken,
				),
				...headersToRecord(options.headers),
			},
			...(user ? { user } : {}),
		};
	}

	private async getAuthSession(): Promise<FitatuAuthSession> {
		const { FitatuAuthClient } =
			await import("../auth/FitatuAuthClient.ts");

		return FitatuAuthClient.getInstance().getSession();
	}

	private resolveAuthenticatedUserId(
		userId: string | undefined,
		user: FitatuUserProfile | undefined,
		session: FitatuAuthSession,
	): string {
		return (
			nonEmptyString(userId) ??
			nonEmptyString(user?.id) ??
			session.fitatuUserId
		);
	}

	private async getCurrentUser(): Promise<FitatuUserProfile | undefined> {
		if (!this.currentUserProvider) {
			return undefined;
		}

		try {
			return await this.currentUserProvider();
		} catch {
			return undefined;
		}
	}

	private resolveBaseUrl(user?: FitatuUserProfile): string {
		if (this.hasExplicitBaseUrl || !user?.locale) {
			return this.fallbackBaseUrl;
		}

		return `https://${toLocaleSegment(user.locale)}.fitatu.com/api`;
	}

	private createDefaultHeaders(
		user: FitatuUserProfile | undefined,
		apiClusterUserId: string | undefined,
		authorizationToken: string | undefined,
	): Record<string, string> {
		const appLocale = nonEmptyString(user?.locale) ?? DEFAULT_APP_LOCALE;
		const searchLocale =
			nonEmptyString(user?.searchLocale) ?? nonEmptyString(user?.locale);
		const storageLocale =
			nonEmptyString(user?.storageLocale) ?? nonEmptyString(user?.locale);
		const timezone = nonEmptyString(user?.timezone) ?? DEFAULT_APP_TIMEZONE;

		return filterHeaders({
			...DEFAULT_FITATU_HEADERS,
			"api-cluster": this.createApiCluster(apiClusterUserId, user),
			"app-storagelocale": storageLocale ?? DEFAULT_APP_LOCALE,
			"app-timezone": timezone,
			"app-searchlocale": searchLocale ?? DEFAULT_APP_LOCALE,
			"app-locale": appLocale,
			authorization: this.createAuthorizationValue(authorizationToken),
		});
	}

	private createAuthorizationValue(
		authorizationToken: string | undefined,
	): string | undefined {
		const token = nonEmptyString(authorizationToken);
		if (!token) {
			return undefined;
		}

		return `Bearer ${token}`;
	}

	private createApiCluster(
		userId: string | undefined,
		user?: FitatuUserProfile,
	): string | undefined {
		const normalizedUserId = nonEmptyString(userId);
		if (!normalizedUserId) {
			return undefined;
		}

		const localeSegment = toLocaleSegment(
			user?.locale ?? DEFAULT_APP_LOCALE,
		);
		return `dart-${localeSegment}${normalizedUserId}`;
	}
}

function headersToRecord(
	headers: Record<string, string | null | undefined> | undefined,
): Record<string, string> {
	if (!headers) {
		return {};
	}

	return filterHeaders(headers);
}

function filterHeaders(
	headers: Record<string, string | null | undefined>,
): Record<string, string> {
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

function createUrl(
	baseUrl: string,
	path: string,
	query:
		| Record<string, string | number | boolean | null | undefined>
		| undefined,
): string {
	const url = new URL(`${baseUrl}${normalizePath(path)}`);

	for (const [name, value] of Object.entries(query ?? {})) {
		if (value === null || value === undefined) {
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
