import { describe, expect, it } from "vitest";
import type { DietSummaryRequest, DietSummaryResult } from "../../../../src/services/dietSummary/DietSummaryTypes.ts";
import type { DietSummaryProvider } from "../../../../src/services/dietSummary/DietSummaryService.ts";
import { GetDietSummaryTool } from "../../../../src/tools/dietSummary/GetDietSummaryTool.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("GetDietSummaryTool", () => {
	it("delegates an inclusive range and returns compact structured content", async () => {
		const service = new FakeDietSummaryService(createSummary());
		const registered = registerToolForTest(new GetDietSummaryTool(service));

		const result = await registered.invoke({ fromDate: "2026-07-13", toDate: "2026-07-14" });
		const expectedContent = {
			period: { fromDate: "2026-07-13", toDate: "2026-07-14", dayCount: 2 },
			energy: {
				loggedTotal: 4100,
				targetTotal: 5000,
				averageLogged: 2050,
				averageTarget: 2500,
				remainingToTarget: 900,
				daily: [
					{ date: "2026-07-13", logged: 2000, target: 2500, remainingToTarget: 500 },
					{ date: "2026-07-14", logged: 2100, target: 2500, remainingToTarget: 400 },
				],
			},
			keyNutrients: [],
			allNutrients: [],
		};

		expect(service.requests).toEqual([{ fromDate: "2026-07-13", toDate: "2026-07-14" }]);
		expect(result.structuredContent).toEqual(expectedContent);
		expect(parseTextContent(result)).toEqual(expectedContent);
	});

	it("rejects malformed dates before calling the service", async () => {
		const service = new FakeDietSummaryService(createSummary());
		const registered = registerToolForTest(new GetDietSummaryTool(service));

		await expect(registered.invoke({ fromDate: "2026/07/13", toDate: "2026-07-14" })).rejects.toThrow();
		expect(service.requests).toHaveLength(0);
	});

	it("redacts unexpected service errors", async () => {
		const service = new FakeDietSummaryService(undefined, new Error("secret summary response"));
		const registered = registerToolForTest(new GetDietSummaryTool(service));

		const result = await registered.invoke({ fromDate: "2026-07-13", toDate: "2026-07-14" });

		expect(result.structuredContent).toEqual({
			status: "error",
			toolName: "get_diet_summary",
			errorName: "Error",
			message: "Unable to fetch Fitatu diet summary.",
		});
		expect(result.content[0]?.text).not.toContain("secret summary response");
	});
});

class FakeDietSummaryService implements DietSummaryProvider {
	public readonly requests: DietSummaryRequest[] = [];

	public constructor(
		private readonly summary?: DietSummaryResult,
		private readonly error?: Error,
	) {}

	public async getDietSummary(request: DietSummaryRequest): Promise<DietSummaryResult> {
		this.requests.push(request);
		if (this.error) {
			throw this.error;
		}
		if (!this.summary) {
			throw new Error("FakeDietSummaryService requires a summary or error");
		}

		return this.summary;
	}
}

function createSummary(): DietSummaryResult {
	return {
		period: { fromDate: "2026-07-13", toDate: "2026-07-14", dayCount: 2 },
		energy: {
			loggedTotal: 4100,
			targetTotal: 5000,
			averageLogged: 2050,
			averageTarget: 2500,
			remainingToTarget: 900,
			daily: [
				{ date: "2026-07-13", logged: 2000, target: 2500, remainingToTarget: 500 },
				{ date: "2026-07-14", logged: 2100, target: 2500, remainingToTarget: 400 },
			],
		},
		keyNutrients: [],
		allNutrients: [],
	};
}
