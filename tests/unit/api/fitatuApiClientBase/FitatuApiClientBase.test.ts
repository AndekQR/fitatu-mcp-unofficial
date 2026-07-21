import { describe, expect, it } from "vitest";
import type { FitatuAuthSession } from "../../../../src/api/auth/FitatuAuthSession.ts";
import { FitatuApiClientBase } from "../../../../src/api/fitatuApiClientBase/FitatuApiClientBase.ts";
import type {
	FitatuAuthProvider,
	FitatuApiClientBaseOptions,
	FitatuUserProvider,
} from "../../../../src/api/fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import type { FitatuApiRequestOptions } from "../../../../src/api/fitatuApiClientBase/FitatuApiRequestOptions.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("FitatuApiClientBase", () => {
	it("builds the Fitatu request and retries once with refreshed authentication after 401", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "expired" }, { status: 401 }),
			createJsonResponse({ ok: true }),
		);
		const authProvider = new MutableAuthProvider({
			token: "expired-token",
			refreshToken: "refresh-token",
			fitatuUserId: "user-1",
		});
		const userProvider = new FakeUserProvider(
			FitatuUserProfile.fromApiResponse({
				id: "user-1",
				locale: "pl_PL",
				searchLocale: "en_GB",
				storageLocale: "pl_PL",
				timezone: "Europe/Warsaw",
			}),
		);
		const client = new TestFitatuApiClient({
			fetchFn: fetchStub.fetchFn,
			authClient: authProvider,
			userClient: userProvider,
		});

		const response = await client.request({
			method: "POST",
			path: "foods/search",
			query: { phrase: "red apple", source: ["local", "remote"], omitted: null },
			body: JSON.stringify({ limit: 10 }),
		});

		expect(response.status).toBe(200);
		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[0]?.input).toBe(
			"https://pl-pl.fitatu.com/api/foods/search?phrase=red+apple&source=local&source=remote",
		);
		expect(fetchStub.calls[0]?.init).toMatchObject({
			method: "POST",
			body: '{"limit":10}',
			headers: {
				"api-cluster": "dart-pl-pluser-1",
				"app-locale": "pl_PL",
				"app-searchlocale": "en_GB",
				"app-storagelocale": "pl_PL",
				authorization: "Bearer expired-token",
			},
		});
		expect(fetchStub.calls[1]?.init).toMatchObject({
			headers: { authorization: "Bearer refreshed-token" },
		});
		expect(authProvider.refreshCount).toBe(1);
		expect(userProvider.clearCount).toBe(1);
	});

	it("returns the second 401 without refreshing or requesting a third time", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "expired" }, { status: 401 }),
			createJsonResponse({ message: "still unauthorized" }, { status: 401 }),
		);
		const authProvider = new MutableAuthProvider({
			token: "expired-token",
			refreshToken: "refresh-token",
			fitatuUserId: "user-1",
		});
		const client = new TestFitatuApiClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient: authProvider,
		});

		const response = await client.request({ method: "GET", path: "/users/user-1" });

		expect(response.status).toBe(401);
		expect(fetchStub.calls).toHaveLength(2);
		expect(authProvider.refreshCount).toBe(1);
	});
});

class TestFitatuApiClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public request(options: FitatuApiRequestOptions): Promise<Response> {
		return this.fetchFitatuApi(options);
	}
}

class MutableAuthProvider implements FitatuAuthProvider {
	public refreshCount = 0;
	private session: FitatuAuthSession;

	public constructor(session: FitatuAuthSession) {
		this.session = session;
	}

	public async getSession(): Promise<FitatuAuthSession> {
		return this.session;
	}

	public async refreshSession(): Promise<FitatuAuthSession> {
		this.refreshCount += 1;
		this.session = { ...this.session, token: "refreshed-token" };
		return this.session;
	}
}

class FakeUserProvider implements FitatuUserProvider {
	public clearCount = 0;

	public constructor(private readonly user: FitatuUserProfile) {}

	public async getCurrentUser(): Promise<FitatuUserProfile> {
		return this.user;
	}

	public clearUserCache(): void {
		this.clearCount += 1;
	}
}
