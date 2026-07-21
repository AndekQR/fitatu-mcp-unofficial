import type { FitatuAuthSession } from "../auth/FitatuAuthSession.ts";
import type { FitatuUserProfile } from "../users/FitatuUserProfile.ts";

export interface FitatuAuthProvider {
	getSession(): Promise<FitatuAuthSession>;
	refreshSession(): Promise<FitatuAuthSession>;
}

export interface FitatuUserProvider {
	getCurrentUser(): Promise<FitatuUserProfile>;
	clearUserCache(): void;
}

export class FitatuApiClientBaseOptions {
	public readonly baseUrl?: string;
	public readonly fetchFn?: typeof fetch;
	public readonly authClient?: FitatuAuthProvider;
	public readonly userClient?: FitatuUserProvider;

	public constructor(options: Partial<FitatuApiClientBaseOptions> = {}) {
		this.baseUrl = options.baseUrl;
		this.fetchFn = options.fetchFn;
		this.authClient = options.authClient;
		this.userClient = options.userClient;
	}
}
