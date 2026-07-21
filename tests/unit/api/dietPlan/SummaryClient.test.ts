import { describe, expect, it } from "vitest";
import { SummaryClient } from "../../../../src/api/dietPlan/SummaryClient.ts";
import { createAuthClientStub } from "../../support/authTestDouble.ts";
import { createFetchStub, createJsonResponse } from "../../support/httpTestDouble.ts";

const authClient = createAuthClientStub({ userId: "user-1" });

describe("SummaryClient", () => {
	it.each([
		{
			operation: "summary",
			path: "/v2/diet-plan/user%2F1/summary/custom",
			response: { protein: { current: 80, min: 60, max: 120, eaten: 80 } },
		},
		{
			operation: "energy",
			path: "/v2/diet-plan/user%2F1/summary/energy/custom",
			response: { targets: { "2026-07-13": 2500 }, measures: { "2026-07-13": 2100 } },
		},
	] as const)(
		"requests the $operation summary for an inclusive date range",
		async ({ operation, path, response }) => {
			const fetchStub = createFetchStub(createJsonResponse(response));
			const client = new SummaryClient({
				baseUrl: "https://fitatu.test/api",
				fetchFn: fetchStub.fetchFn,
				authClient,
			});
			const request = { userId: "user/1", fromDate: "2026-07-12", toDate: "2026-07-13" };

			const result =
				operation === "summary" ? await client.getSummary(request) : await client.getEnergySummary(request);

			expect(result).toEqual(response);
			expect(fetchStub.calls[0]?.input).toBe(
				`https://fitatu.test/api${path}?fromDate=2026-07-12&toDate=2026-07-13`,
			);
			expect(fetchStub.calls[0]?.init).toMatchObject({
				method: "GET",
				headers: { accept: "application/json; version=v3" },
			});
		},
	);

	it("rejects an inverted date range without making a request", async () => {
		const fetchStub = createFetchStub();
		const client = new SummaryClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
		});

		await expect(
			client.getSummary({ userId: "user-1", fromDate: "2026-07-14", toDate: "2026-07-13" }),
		).rejects.toThrow("fromDate must be before or equal to toDate");
		expect(fetchStub.calls).toHaveLength(0);
	});

	it("rejects an energy summary with malformed nested values", async () => {
		const fetchStub = createFetchStub(
			createJsonResponse({ targets: { "2026-07-13": "2500" }, measures: { "2026-07-13": 2100 } }),
		);
		const client = new SummaryClient({
			baseUrl: "https://fitatu.test/api",
			fetchFn: fetchStub.fetchFn,
			authClient,
		});

		await expect(
			client.getEnergySummary({ userId: "user-1", fromDate: "2026-07-13", toDate: "2026-07-13" }),
		).rejects.toThrow("Fitatu diet plan summary response was invalid");
	});
});
