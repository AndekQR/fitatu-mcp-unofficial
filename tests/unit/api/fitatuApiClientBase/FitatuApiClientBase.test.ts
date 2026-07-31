import { describe, expect, it } from "vitest";
import type { FitatuAuthSession } from "../../../../src/api/auth/FitatuAuthSession.ts";
import { FitatuApiClientBase } from "../../../../src/api/fitatuApiClientBase/FitatuApiClientBase.ts";
import type {
	FitatuApiClientBaseOptions,
	FitatuAuthProvider,
	FitatuUserProvider,
} from "../../../../src/api/fitatuApiClientBase/FitatuApiClientBaseOptions.ts";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FITATU_CLIENT_OPERATIONS } from "../../../../src/api/fitatuApiClientBase/FitatuClientOperations.ts";
import type { FitatuJsonRequestOptions } from "../../../../src/api/fitatuApiClientBase/FitatuJsonRequestOptions.ts";
import { FitatuResponseDecodeError } from "../../../../src/api/fitatuApiClientBase/FitatuResponseDecodeError.ts";
import { FitatuMobileClientProfile } from "../../../../src/api/fitatuApiClientBase/FitatuMobileClientProfile.ts";
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
			mobileClientProfile: new FitatuMobileClientProfile("Dart/3.11 (dart:io)", "4.15.0", "BUILD.123"),
		});

		const response = await client.request({
			operation: FITATU_CLIENT_OPERATIONS.foodSearch,
			method: "POST",
			path: "foods/search",
			endpointTemplate: "/foods/search",
			failureMessage: "Fitatu food search request failed",
			query: { phrase: "red apple", source: ["local", "remote"], omitted: null },
			body: JSON.stringify({ limit: 10 }),
			decoder: decodeObject,
		});

		expect(response).toEqual({ ok: true });
		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[0]?.input).toBe(
			"https://pl-pl.fitatu.com/api/foods/search?phrase=red+apple&source=local&source=remote",
		);
		expect(fetchStub.calls[0]?.init).toMatchObject({
			method: "POST",
			body: '{"limit":10}',
			headers: {
				"api-cluster": "dart-pl-pluser-1",
				"api-apk-uuid": "BUILD.123",
				"app-locale": "pl_PL",
				"app-searchlocale": "en_GB",
				"app-storagelocale": "pl_PL",
				"app-version": "4.15.0",
				authorization: "Bearer expired-token",
				"user-agent": "Dart/3.11 (dart:io)",
			},
		});
		expect(fetchStub.calls[1]?.init).toMatchObject({
			headers: { authorization: "Bearer refreshed-token" },
		});
		expect(authProvider.refreshCount).toBe(1);
		expect(userProvider.clearCount).toBe(1);
	});

	it("throws one HTTP error with the first 401 recorded as an attempt", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "expired", token: "secret-token" }, { status: 401 }),
			createJsonResponse({ message: "still unauthorized", email: "person@example.com" }, { status: 401 }),
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

		const request = client.request({
			operation: FITATU_CLIENT_OPERATIONS.usersGet,
			method: "GET",
			path: "/users/user-1",
			endpointTemplate: "/users/:userId",
			failureMessage: "Fitatu user request failed",
			decoder: decodeObject,
		});

		await expect(request).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu user request failed",
			operation: "users.get",
			failure: {
				kind: "http",
				method: "GET",
				endpointTemplate: "/users/:userId",
				statusCode: 401,
				responseSnippet: '{"message":"still unauthorized","email":"[REDACTED]"}',
			},
			attempts: [
				{
					kind: "http",
					statusCode: 401,
					responseSnippet: '{"message":"expired","token":"[REDACTED]"}',
				},
			],
		});
		expect(fetchStub.calls).toHaveLength(2);
		expect(authProvider.refreshCount).toBe(1);
	});

	it("maps recognized decoder failures but lets unexpected defects escape", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ unexpected: true }),
			createJsonResponse({ unexpected: true }),
		);
		const client = new TestFitatuApiClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
		});
		const options = {
			operation: FITATU_CLIENT_OPERATIONS.usersGet,
			method: "GET",
			path: "/users/user-1",
			endpointTemplate: "/users/:userId",
			failureMessage: "Fitatu user request failed",
		} as const;

		const invalidResponse = client.request({
			...options,
			decoder: () => {
				throw new FitatuResponseDecodeError("User response was invalid");
			},
		});
		await expect(invalidResponse).rejects.toMatchObject({
			name: "FitatuClientError",
			failure: {
				kind: "invalidResponse",
				method: "GET",
				endpointTemplate: "/users/:userId",
			},
		});

		const programmerDefect = new RangeError("Unexpected decoder defect");
		const unexpectedResponse = client.request({
			...options,
			decoder: () => {
				throw programmerDefect;
			},
		});
		await expect(unexpectedResponse).rejects.toBe(programmerDefect);
	});

	it("maps recognized fetch failures to transport errors", async () => {
		const networkError = new TypeError("fetch failed");
		const client = new TestFitatuApiClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: async () => {
				throw networkError;
			},
		});

		const request = client.request({
			operation: FITATU_CLIENT_OPERATIONS.usersGet,
			method: "GET",
			path: "/users/user-1",
			endpointTemplate: "/users/:userId",
			failureMessage: "Fitatu user request failed",
			decoder: decodeObject,
		});

		await expect(request).rejects.toMatchObject({
			name: "FitatuClientError",
			operation: "users.get",
			failure: {
				kind: "transport",
				method: "GET",
				endpointTemplate: "/users/:userId",
				errorName: "TypeError",
			},
			attempts: [],
		});
		await expect(request).rejects.toBeInstanceOf(FitatuClientError);
	});
});

class TestFitatuApiClient extends FitatuApiClientBase {
	public constructor(options: FitatuApiClientBaseOptions = {}) {
		super(options);
	}

	public request(options: FitatuJsonRequestOptions<unknown>): Promise<unknown> {
		return this.performCallout(options);
	}
}

function decodeObject(data: unknown): Record<string, unknown> {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new FitatuResponseDecodeError("Response was not an object");
	}

	return data as Record<string, unknown>;
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
