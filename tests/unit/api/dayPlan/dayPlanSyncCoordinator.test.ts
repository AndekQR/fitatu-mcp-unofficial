import { describe, expect, it } from "vitest";
import { DayRevisions } from "../../../../src/api/dayPlan/DayRevisions.ts";
import { DayPlanSyncCoordinator } from "../../../../src/api/dayPlan/DayPlanSyncCoordinator.ts";
import {
	FITATU_DAY_DATE_FIXTURE,
	FITATU_DAY_RESPONSE_FIXTURE,
	FITATU_DAY_SYNC_PAYLOAD_FIXTURE,
	FITATU_DAY_SYNC_RECEIPTS_FIXTURE,
} from "../../../fixtures/fitatuDayContractFixture.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

describe("DayPlanSyncCoordinator.getDaySyncPayload", () => {
	it("normalizes the Fitatu day response into a synchronization payload", async () => {
		const fetchStub = createFetchStub(createJsonResponse(FITATU_DAY_RESPONSE_FIXTURE));
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		const payload = await service.getDaySyncPayload("user 1", FITATU_DAY_DATE_FIXTURE);

		expect(payload).toEqual(FITATU_DAY_SYNC_PAYLOAD_FIXTURE);
		expect(fetchStub.calls[0]?.input).toBe(
			`https://fitatu.test/api/diet-and-activity-plan/user%201/day/${FITATU_DAY_DATE_FIXTURE}`,
		);
	});

	it("uses current neutral values and accepts the legacy toiletItems read field", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({
				dietPlan: { breakfast: { items: [] } },
				toiletItems: [{ type: "LEGACY" }],
			}),
		);
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		const payload = await service.getDaySyncPayload("user-1", "2026-07-12");

		expect(payload).toEqual({
			planDayRevisions: [],
			activities: [],
			dietPlan: { breakfast: { items: [] } },
			toilet: [{ type: "LEGACY" }],
			water: { waterConsumption: 0 },
			note: null,
			tagsIds: [],
		});
		expect(payload).not.toHaveProperty("toiletItems");
	});

	it("rejects a response without an object diet plan", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ dietPlan: null }));
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.getDaySyncPayload("user-1", "2026-07-12")).rejects.toThrow(
			"dietPlan was not a valid JSON object",
		);
	});
});

describe("DayPlanSyncCoordinator synchronization", () => {
	it("posts a single day payload to the authenticated user's days endpoint", async () => {
		const fetchStub = createFetchStub(createJsonResponse(FITATU_DAY_SYNC_RECEIPTS_FIXTURE, { status: 202 }));
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });
		const payload = FITATU_DAY_SYNC_PAYLOAD_FIXTURE;

		const dayRevisions = await service.syncSingleDay("user/1", FITATU_DAY_DATE_FIXTURE, payload);

		expect(dayRevisions).toBeInstanceOf(DayRevisions);
		expect(dayRevisions.toRecord()).toEqual({ [FITATU_DAY_DATE_FIXTURE]: "revision-1" });
		expect(fetchStub.calls).toHaveLength(1);
		expect(fetchStub.calls[0]).toMatchObject({
			input: "https://fitatu.test/api/diet-plan/user%2F1/days",
			init: {
				method: "POST",
				body: JSON.stringify({ [FITATU_DAY_DATE_FIXTURE]: payload }),
				headers: { "content-type": "application/json;charset=UTF-8" },
			},
		});
		expect(fetchStub.calls[0]?.init?.headers).not.toHaveProperty("accept");
	});

	it("propagates an upstream synchronization failure from the API client", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "upstream rejected the day" }, { status: 500, statusText: "Failure" }),
		);
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu day synchronization request failed",
			operation: "dayPlan.sync",
			failure: {
				kind: "http",
				method: "POST",
				endpointTemplate: "/diet-plan/:userId/days",
				statusCode: 500,
			},
			attempts: [],
		});
	});

	it("rejects a day receipt containing an upstream errorMessage", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ date: "2026-07-12", revision: null, errorMessage: "revision conflict" }], {
				status: 202,
			}),
		);
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu day synchronization response was invalid",
			failure: { kind: "invalidResponse" },
		});
	});

	it("rejects a malformed successful synchronization response", async () => {
		const fetchStub = createFetchStub(createJsonResponse({ date: "2026-07-12" }, { status: 202 }));
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu day synchronization response was invalid",
			failure: { kind: "invalidResponse" },
		});
	});

	it("rejects an empty response from the current synchronization endpoint", async () => {
		const fetchStub = createFetchStub(new Response(null, { status: 204 }));
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "FitatuClientError",
			message: "Fitatu day synchronization response was invalid",
			failure: { kind: "invalidResponse" },
		});
		expect(fetchStub.calls).toHaveLength(1);
	});

	it("returns no revisions only after a successful legacy fallback empty response", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ message: "missing" }, { status: 404 }),
			new Response(null, { status: 204 }),
		);
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		const dayRevisions = await service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } });

		expect(dayRevisions).toBeInstanceOf(DayRevisions);
		expect(dayRevisions.toRecord()).toEqual({});
		expect(fetchStub.calls.map(({ input }) => input)).toEqual([
			"https://fitatu.test/api/diet-plan/user-1/days",
			"https://fitatu.test/api/v2/diet-plan/user-1/days",
		]);
	});

	it("normalizes an empty receipt errorMessage as a successful receipt", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse([{ date: "2026-07-12", revision: "revision-1", errorMessage: "   " }], { status: 202 }),
		);
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn: fetchStub.fetchFn });

		const dayRevisions = await service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } });

		expect(dayRevisions).toBeInstanceOf(DayRevisions);
		expect(dayRevisions.toRecord()).toEqual({
			"2026-07-12": "revision-1",
		});
	});

	it("propagates an unexpected network synchronization failure", async () => {
		const fetchFn: typeof fetch = async () => {
			throw new Error("socket contained a secret");
		};
		const service = new DayPlanSyncCoordinator({ baseUrl: "https://fitatu.test/api", fetchFn });

		await expect(service.syncDays("user-1", { "2026-07-12": { dietPlan: {} } })).rejects.toMatchObject({
			name: "Error",
			message: "socket contained a secret",
		});
	});
});
