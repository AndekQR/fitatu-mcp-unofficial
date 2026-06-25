import type { FitatuAuthClient } from "../auth/FitatuAuthClient.ts";
import type { FitatuUserClient } from "../users/FitatuUserClient.ts";

export class FitatuApiClientBaseOptions {
	public readonly baseUrl?: string;
	public readonly fetchFn?: typeof fetch;
	public readonly authClient?: FitatuAuthClient;
	public readonly userClient?: FitatuUserClient;

	public constructor(options: Partial<FitatuApiClientBaseOptions> = {}) {
		this.baseUrl = options.baseUrl;
		this.fetchFn = options.fetchFn;
		this.authClient = options.authClient;
		this.userClient = options.userClient;
	}
}
