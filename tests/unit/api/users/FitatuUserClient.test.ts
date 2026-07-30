import { describe, expect, it } from "vitest";
import { FitatuClientError } from "../../../../src/api/fitatuApiClientBase/FitatuClientError.ts";
import { FitatuUserClient } from "../../../../src/api/users/FitatuUserClient.ts";
import { FitatuUserMeta } from "../../../../src/api/users/FitatuUserMeta.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
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
				promoCodePlans: [{ code: "SUMMER", active: true }],
				experimentalFlag: "preserved",
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
			name: "FitatuClientError",
			operation: "users.get",
			failure: {
				kind: "http",
				method: "GET",
				endpointTemplate: "/users/:userId",
				statusCode: 503,
			},
			attempts: [],
		});
		await expect(failedRequest).rejects.toBeInstanceOf(FitatuClientError);
		const first = await client.getAuthenticatedUser();
		const second = await client.getCurrentUser();

		expect(fetchStub.calls).toHaveLength(2);
		expect(fetchStub.calls[0]?.input).toBe("https://fitatu.test/api/users/user%2F1");
		expect(fetchStub.calls[1]?.input).toBe("https://fitatu.test/api/users/user%2F1");
		expect(first).toBe(second);
		expect(first).toBeInstanceOf(FitatuUserProfile);
		expect(first).toMatchObject({ id: "user/1", nickname: "Test user", locale: "pl_PL" });
		expect(first.meta).toBeInstanceOf(FitatuUserMeta);
		expect(first.meta).toMatchObject({ goalAchievement: "maintain" });
		expect(first.rawData).toMatchObject({ experimentalFlag: "preserved" });
		expect(first.promoCodePlans[0]?.rawData).toEqual({ code: "SUMMER", active: true });
	});
});
