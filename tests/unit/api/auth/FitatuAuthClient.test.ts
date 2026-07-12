import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("FitatuAuthClient", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("logs in once and reuses the authenticated session", async () => {
		const token = createJwt({ user_id: "user-1" });
		const fetchStub = createFetchStub(createJsonResponse({ token, refresh_token: "refresh-1" }));
		const client = await createAuthClient(fetchStub.fetchFn);

		const firstSession = await client.getSession();
		const secondSession = await client.getSession();

		expect(firstSession).toEqual({ token, refreshToken: "refresh-1", fitatuUserId: "user-1" });
		expect(secondSession).toBe(firstSession);
		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]).toMatchObject({
			input: "https://fitatu.test/api/login",
			init: {
				method: "POST",
				body: '{"_username":"test@example.invalid","_password":"secret"}',
			},
		});
	});

	it("maps a failed login without exposing sensitive response values", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse(
				{ message: "invalid credentials", token: "upstream-token", email: "person@example.invalid" },
				{ status: 401, statusText: "Unauthorized" },
			),
		);
		const client = await createAuthClient(fetchStub.fetchFn);

		const error = await client.getSession().catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			name: "FitatuAuthError",
			message: "Fitatu login failed",
			statusCode: 401,
			fitatuApiError: {
				method: "POST",
				path: "/login",
				upstreamMessage: "invalid credentials",
				responseSnippet:
					'{"message":"invalid credentials","token":"[REDACTED]","email":"[REDACTED]"}',
			},
		});
	});

	it("refreshes the access token while preserving session identity", async () => {
		const loginToken = createJwt({ sub: "user-1" });
		const refreshedToken = createJwt({ sub: "user-1", version: 2 });
		const fetchStub = createFetchStub(
			createJsonResponse({ access_token: loginToken, refresh_token: "refresh-1" }),
			createJsonResponse({ access_token: refreshedToken }),
		);
		const client = await createAuthClient(fetchStub.fetchFn);

		await client.getSession();
		const refreshedSession = await client.refreshSession();

		expect(refreshedSession).toEqual({
			token: refreshedToken,
			refreshToken: "refresh-1",
			fitatuUserId: "user-1",
		});
		expect(fetchStub.calls[1]).toMatchObject({
			input: "https://fitatu.test/api/token/refresh",
			init: {
				method: "POST",
				body: '{"refresh_token":"refresh-1"}',
			},
		});
	});

	it("clears the session and redacts every upstream error when refresh variants fail", async () => {
		const loginToken = createJwt({ sub: "user-1" });
		const refreshFailure = () =>
			createJsonResponse(
				{ message: "refresh rejected", token: "sensitive-token", user: "sensitive-user" },
				{ status: 401 },
			);
		const fetchStub = createFetchStub(
			createJsonResponse({ token: loginToken, refresh_token: "refresh-1" }),
			refreshFailure(),
			refreshFailure(),
			refreshFailure(),
		);
		const client = await createAuthClient(fetchStub.fetchFn);
		await client.getSession();

		const error = await client.refreshSession().catch((caught: unknown) => caught);

		expect(error).toMatchObject({
			name: "FitatuAuthError",
			message: "Fitatu token refresh failed",
			statusCode: 401,
		});
		expect(error.fitatuApiErrors).toHaveLength(3);
		expect(error.fitatuApiErrors.map((details: { responseSnippet: string }) => details.responseSnippet)).toEqual([
			'{"message":"refresh rejected","token":"[REDACTED]","user":"[REDACTED]"}',
			'{"message":"refresh rejected","token":"[REDACTED]","user":"[REDACTED]"}',
			'{"message":"refresh rejected","token":"[REDACTED]","user":"[REDACTED]"}',
		]);
		expect(fetchStub.calls).toHaveLength(4);
		expect(fetchStub.calls.slice(1).map((call) => call.init?.body)).toEqual([
			'{"refresh_token":"refresh-1"}',
			'{"refreshToken":"refresh-1"}',
			'{"token":"refresh-1"}',
		]);
		await expect(client.refreshSession()).rejects.toThrow("Fitatu refresh token is missing");
	});
});

async function createAuthClient(fetchFn: typeof fetch) {
	const { FitatuAuthClient } = await import("../../../../src/api/auth/FitatuAuthClient.ts");
	return FitatuAuthClient.getInstance({
		baseUrl: "https://fitatu.test/api",
		fetchFn,
		credentialsProvider: () => ({ username: "test@example.invalid", password: "secret" }),
	});
}

function createJwt(payload: Record<string, unknown>): string {
	return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}
