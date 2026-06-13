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
import { nonEmptyString, toLocaleSegment } from "./fitatuApiLocale.ts";
import { normalizeBaseUrl, normalizePath } from "./fitatuApiUrl.ts";

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

  protected async createRequestContext(
    options: FitatuApiRequestOptions,
  ): Promise<FitatuRequestContext> {
    const user = options.bootstrap ? undefined : await this.getCurrentUser();
    const baseUrl = this.resolveBaseUrl(user);

    return {
      url: `${baseUrl}${normalizePath(options.path)}`,
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

    const localeSegment = toLocaleSegment(user?.locale ?? DEFAULT_APP_LOCALE);
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
