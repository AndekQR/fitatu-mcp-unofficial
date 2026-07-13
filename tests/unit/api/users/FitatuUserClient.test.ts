import { describe, expect, it } from "vitest";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { FitatuUserError } from "../../../../src/api/users/FitatuUserError.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("FitatuUserClient", () => {
	it("does not cache a failed request and caches the next successful authenticated user response", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "temporary failure" }, { status: 503 }),
			createJsonResponse({
				id: "user/1",
				nickname: "Test user",
				locale: "pl_PL",
				meta: { goalAchievement: "maintain" },
			}),
		);
		const authClient = createAuthClientStub({ userId: "user/1" });
		const client = FitatuUserClient.getInstance({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
		});
		client.clearUserCache();

		const failedRequest = client.getAuthenticatedUser();
		await expect(failedRequest).rejects.toMatchObject({
			name: "FitatuUserError",
			statusCode: 503,
		});
		await expect(failedRequest).rejects.toBeInstanceOf(FitatuUserError);
		const first = await client.getAuthenticatedUser();
		const second = await client.getCurrentUser();

		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user%2F1");
		expect(fetchStub.calls[1]?.input).toBe("https://fitatu.test/api/users/user%2F1");
		expect(first).toBe(second);
		expect(first).toMatchObject({ id: "user/1", nickname: "Test user", locale: "pl_PL" });
		expect(first.meta).toMatchObject({ goalAchievement: "maintain" });
	});
});
