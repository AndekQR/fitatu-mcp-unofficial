import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";

export interface FitatuSessionProvider {
	getSession(): Promise<FitatuAuthSession>;
}

export interface FitatuCurrentUserProvider {
	getCurrentUser(): Promise<FitatuUserProfile | undefined>;
}

export interface FitatuApiClientBaseOptions {
	readonly baseUrl?: string;
	readonly fetchFn?: typeof fetch;
	readonly sessionProvider?: FitatuSessionProvider;
	readonly currentUserProvider?: FitatuCurrentUserProvider;
}
