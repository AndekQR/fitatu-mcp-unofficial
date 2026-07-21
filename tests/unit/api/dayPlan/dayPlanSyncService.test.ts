import { describe, expect, it } from "vitest";
import { DayPlanSyncService } from "../../../../src/api/dayPlan/DayPlanSyncService.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("DayPlanSyncService.getDaySyncPayload", () => {
	it("normalizes the Fitatu day response into a synchronization payload", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ dietPlan: { breakfast: { items: [] } }, note: "note" }));
		const service = new DayPlanSyncService({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		const payload = await service.getDaySyncPayload("user 1", "2026-07-12");

		expect(payload).toEqual({
			dietPlan: { breakfast: { items: [] } },
			toiletItems: [],
			note: "note",
			tagsIds: [],
		});
		expect(fetchStub.calls[0]?.input).toBe(
			"https://fitatu.test/api/diet-and-activity-plan/user%201/day/2026-07-12",
		);
	});

	it("rejects a response without an object diet plan", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ dietPlan: null }));
		const service = new DayPlanSyncService({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.getDaySyncPayload("user-1", "2026-07-12")).rejects.toThrow(
			"dietPlan was not a valid JSON object",
		);
	});
});

describe("DayPlanSyncService synchronization", () => {
	it("posts a single day payload to the authenticated user's days endpoint", async () => {
		const fetchStub = createFetchStub(new Response(null, { status: 204 }));
		const service = new DayPlanSyncService({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });
		const payload = { dietPlan: {}, toiletItems: [], note: null, tagsIds: [] };

		await service.syncSingleDay("user/1", "2026-07-12", payload);

		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]).toMatchObject({
			input: "https://fitatu.test/api/diet-plan/user%2F1/days",
			init: { method: "POST", body: JSON.stringify({ "2026-07-12": payload }) },
		});
	});

	it("maps an upstream synchronization failure to a safe day plan error", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "upstream rejected the day" }, { status: 500, statusText: "Failure" }),
		);
		const service = new DayPlanSyncService({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "DayPlanError",
			message: "upstream rejected the day",
			statusCode: 500,
		});
	});

	it("redacts an unexpected network synchronization failure", async () => {
		const fetchFn: typeof fetch = async () => {
			throw new Error("socket contained a secret");
		};
		const service = new DayPlanSyncService({ baseUrl: "https://fitatu.test/api", fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "DayPlanError",
			message: "Fitatu day synchronization request failed",
		});
	});
});
