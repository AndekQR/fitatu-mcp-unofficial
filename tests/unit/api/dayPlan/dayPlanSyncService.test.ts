import { describe, expect, it } from "vitest";
import { DayPlanSyncService } from "../../../../src/api/dayPlan/DayPlanSyncService.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("DayPlanSyncService.getDaySyncPayload", () => {
	it("normalizes the Fitatu day response into a synchronization payload", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ dietPlan: { breakfast: { items: [] } }, note: "note" }),
		);
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
