import { describe, expect, it } from "vitest";
import type { GetEnergySummaryResponse } from "../../../../src/api/dietPlan/GetEnergySummaryResponse.ts";
import type { GetEnergySummaryRequest } from "../../../../src/api/dietPlan/GetEnergySummaryRequest.ts";
import type { GetSummaryRequest } from "../../../../src/api/dietPlan/GetSummaryRequest.ts";
import type { GetSummaryResponse } from "../../../../src/api/dietPlan/GetSummaryResponse.ts";
import { FitatuUserProfile } from "../../../../src/api/users/FitatuUserProfile.ts";
import { DietSummaryService } from "../../../../src/services/dietSummary/DietSummaryService.ts";

describe("DietSummaryService.getDietSummary", () => {
	it("combines the authenticated user's summaries into period totals and nutrient statuses", async () => {
		const summaryClient = new FakeSummaryClient(
			{
				protein: { current: 50, min: 70, max: 120, eaten: 50 },
				fat: { current: 140, min: 40, max: 100, eaten: 140 },
				customTraceElement: { current: 12, min: null, max: null, eaten: 12 },
			},
			{
				targets: { "2026-07-12": 2500, "2026-07-13": 2500 },
				measures: { "2026-07-12": 2000, "2026-07-13": 2600 },
			},
		);
		const userClient = {
			getAuthenticatedUser: async () => FitatuUserProfile.fromApiResponse({ id: " user-123 " }),
		};
		const service = new DietSummaryService(summaryClient, userClient);

		const result = await service.getDietSummary({ fromDate: " 2026-07-12 ", toDate: "2026-07-13" });

		expect(summaryClient.requests).toEqual([
			{ operation: "summary", userId: "user-123", fromDate: "2026-07-12", toDate: "2026-07-13" },
			{ operation: "energy", userId: "user-123", fromDate: "2026-07-12", toDate: "2026-07-13" },
		]);
		expect(result.period).toEqual({ fromDate: "2026-07-12", toDate: "2026-07-13", dayCount: 2 });
		expect(result.energy).toEqual({
			loggedTotal: 4600,
			targetTotal: 5000,
			averageLogged: 2300,
			averageTarget: 2500,
			remainingToTarget: 400,
			daily: [
				{ date: "2026-07-12", logged: 2000, target: 2500, remainingToTarget: 500 },
				{ date: "2026-07-13", logged: 2600, target: 2500, remainingToTarget: -100 },
			],
		});
		expect(result.keyNutrients.map((nutrient) => nutrient.key)).toEqual(["protein", "fat"]);
		expect(result.allNutrients).toEqual([
			{
				key: "protein",
				label: "Protein",
				unit: "g",
				current: 50,
				min: 70,
				max: 120,
				eaten: 50,
				status: "belowMin",
				amountToMinimum: 20,
				amountOverMaximum: undefined,
				remainingToMaximum: 70,
			},
			{
				key: "fat",
				label: "Fat",
				unit: "g",
				current: 140,
				min: 40,
				max: 100,
				eaten: 140,
				status: "aboveMax",
				amountToMinimum: undefined,
				amountOverMaximum: 40,
				remainingToMaximum: undefined,
			},
			{
				key: "customTraceElement",
				label: "Custom Trace Element",
				unit: undefined,
				current: 12,
				min: null,
				max: null,
				eaten: 12,
				status: "noTarget",
				amountToMinimum: undefined,
				amountOverMaximum: undefined,
				remainingToMaximum: undefined,
			},
		]);
	});

	it("rejects an inverted date range before loading the user or summaries", async () => {
		const summaryClient = new FakeSummaryClient({}, { targets: {}, measures: {} });
		let userRequestCount = 0;
		const userClient = {
			getAuthenticatedUser: async () => {
				userRequestCount += 1;
				return FitatuUserProfile.fromApiResponse({ id: "user-123" });
			},
		};
		const service = new DietSummaryService(summaryClient, userClient);

		await expect(service.getDietSummary({ fromDate: "2026-07-14", toDate: "2026-07-13" })).rejects.toThrow(
			"fromDate must be before or equal to toDate",
		);
		expect(userRequestCount).toBe(0);
		expect(summaryClient.requests).toHaveLength(0);
	});
});

class FakeSummaryClient {
	public readonly requests: SummaryRequestCall[] = [];

	public constructor(
		private readonly summary: GetSummaryResponse,
		private readonly energySummary: GetEnergySummaryResponse,
	) {}

	public async getSummary(request: GetSummaryRequest): Promise<GetSummaryResponse> {
		this.requests.push({ operation: "summary", ...request });
		return this.summary;
	}

	public async getEnergySummary(request: GetEnergySummaryRequest): Promise<GetEnergySummaryResponse> {
		this.requests.push({ operation: "energy", ...request });
		return this.energySummary;
	}
}

type SummaryRequestCall = GetSummaryRequest & { readonly operation: "summary" | "energy" };
