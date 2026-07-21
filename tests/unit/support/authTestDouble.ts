import type { FitatuAuthProvider } from "../../../src/api/fitatuApiClientBase/FitatuApiClientBaseOptions.ts";

export function createAuthClientStub(options: {
	readonly userId: string;
	readonly token?: string;
}): FitatuAuthProvider {
	return {
		getSession: async () => ({ token: options.token ?? "test-token", fitatuUserId: options.userId }),
		refreshSession: async () => ({ token: "refreshed-test-token", fitatuUserId: options.userId }),
	};
}
