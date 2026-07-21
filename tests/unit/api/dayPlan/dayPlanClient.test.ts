import { describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../../src/api/dayPlan/DayPlanClient.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("DayPlanClient.getDayPlan", () => {
	it("fetches and maps the requested authenticated user's day plan", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ dietPlan: { breakfast: { items: [] } } }));
		const authClient = {
			getSession: async () => ({ token: "token", fitatuUserId: "user-1" }),
			refreshSession: async () => ({ token: "token-2", fitatuUserId: "user-1" }),
		};
		const userClient = {
			getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
			clearUserCache: () => undefined,
		};
		const client = new DayPlanClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
			userClient,
		});

		const plan = await client.getDayPlan({ date: "2026-07-12", withRating: true });

		expect(plan).toMatchObject({ date: "2026-07-12", userId: "user-1" });
		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/diet-and-activity-plan/user-1/day/2026-07-12?withRating=true",
		);
	});

	it("rejects an invalid date before making a request", async () => {
		const fetchStub = createFetchStub();
		const client = createClient(fetchStub.fetchFn);

		await expect(client.getDayPlan({ date: "2026-02-30" })).rejects.toThrow("date must be a valid calendar date");
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects a malformed day plan response", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ dietPlan: null }));
		const client = createClient(fetchStub.fetchFn);

		await expect(client.getDayPlan({ date: "2026-07-12" })).rejects.toThrow(
			"DayPlan response did not contain dietPlan",
		);
	});
});

function createClient(fetchFn: typeof fetch): DayPlanClient {
	return new DayPlanClient({
		baseUrl: "https://fitatu.test/api",
		fetchFn,
		authClient: {
			getSession: async () => ({ token: "token", fitatuUserId: "user-1" }),
			refreshSession: async () => ({ token: "token-2", fitatuUserId: "user-1" }),
		},
		userClient: {
			getCurrentUser: async () => FitatuUserProfile.fromApiResponse({ id: "user-1", locale: "pl_PL" }),
			clearUserCache: () => undefined,
		},
	});
}
