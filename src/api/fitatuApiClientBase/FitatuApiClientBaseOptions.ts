import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";

export interface FitatuSessionProvider {
	getSession(): Promise<FitatuAuthSession>;
	clearSession?(): void | Promise<void>;
}

export interface FitatuCurrentUserProvider {
	getCurrentUser(): Promise<FitatuUserProfile | undefined>;
	clearUserCache?(): void | Promise<void>;
}

export interface FitatuApiClientBaseOptions {
	readonly baseUrl?: string;
	readonly fetchFn?: typeof fetch;
	readonly sessionProvider?: FitatuSessionProvider;
	readonly currentUserProvider?: FitatuCurrentUserProvider;
}
