import { describe, expect, it } from "vitest";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";
import type { GetDayPlanOptions } from "../../../../src/api/dayPlan/DayPlanClientTypes.ts";
import type { DayPlanQueryProvider } from "../../../../src/services/dayPlan/DayPlanQueryService.ts";
import { GetDayPlanItemsTool } from "../../../../src/tools/dayPlanItems/GetDayPlanItemsTool.ts";
import { parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("GetDayPlanItemsTool", () => {
	it("delegates the validated date and returns MCP-safe day plan items", async () => {
		const service = new FakeDayPlanQueryService(createDayPlan());
		const registered = registerToolForTest(new GetDayPlanItemsTool(service));

		const result = await registered.invoke({ date: "2026-07-14", withRating: true });
		const expectedContent = {
			date: "2026-07-14",
			meals: [
				{
					mealKey: "breakfast",
					mealTime: "08:00",
					items: [
						{
							itemId: "item-1",
							name: "Owsianka",
							foodType: "PRODUCT",
							productId: "123",
							measureId: "measure-1",
							measureQuantity: 1,
							eaten: false,
						},
					],
				},
			],
		};

		expect(service.requests).toEqual([{ date: "2026-07-14", withRating: true }]);
		expect(result.structuredContent).toEqual(expectedContent);
		expect(parseTextContent(result)).toEqual(expectedContent);
	});

	it("rejects an invalid date before calling the service", async () => {
		const service = new FakeDayPlanQueryService(createDayPlan());
		const registered = registerToolForTest(new GetDayPlanItemsTool(service));

		await expect(registered.invoke({ date: "14-07-2026" })).rejects.toThrow();
		expect(service.requests).toHaveLength(0);
	});

	it("redacts an unexpected service error", async () => {
		const service = new FakeDayPlanQueryService(undefined, new Error("secret day plan response"));
		const registered = registerToolForTest(new GetDayPlanItemsTool(service));

		const result = await registered.invoke({ date: "2026-07-14" });

		expect(result.structuredContent).toEqual({
			status: "error",
			toolName: "get_day_plan_items",
			errorName: "Error",
			message: "Unable to fetch Fitatu day plan items.",
		});
		expect(result.content[0]?.text).not.toContain("secret day plan response");
	});
});

class FakeDayPlanQueryService implements DayPlanQueryProvider {
	public readonly requests: GetDayPlanOptions[] = [];

	public constructor(
		private readonly dayPlan?: DayPlan,
		private readonly error?: Error,
	) {}

	public async getDayPlan(options: GetDayPlanOptions): Promise<DayPlan> {
		this.requests.push(options);
		if (this.error) {
			throw this.error;
		}
		if (!this.dayPlan) {
			throw new Error("FakeDayPlanQueryService requires a day plan or error");
		}

		return this.dayPlan;
	}
}

function createDayPlan(): DayPlan {
	return DayPlan.fromApiResponse({
		date: "2026-07-14",
		userId: "user-1",
		data: {
			dietPlan: {
				breakfast: {
					mealTime: "08:00",
					items: [
						{
							planDayDietItemId: "item-1",
							name: "Owsianka",
							foodType: "PRODUCT",
							productId: 123,
							measureId: "measure-1",
							measureQuantity: 1,
							eaten: false,
						},
					],
				},
			},
		},
	});
}
