import { describe, expect, it } from "vitest";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";
import type { GetDayPlanOptions } from "../../../../src/api/dayPlan/GetDayPlanOptions.ts";
import type { DayPlanQueryProvider } from "../../../../src/services/dayPlan/DayPlanQueryService.ts";
import { GetDayPlanItemsTool } from "../../../../src/tools/dayPlanItems/GetDayPlanItemsTool.ts";
import { getTextContent, parseTextContent, registerToolForTest } from "../../support/mcpToolTestDouble.ts";

describe("GetDayPlanItemsTool", () => {
	it("delegates the validated date and returns MCP-safe day plan items", async () => {
		const service = new FakeDayPlanQueryService(createDayPlan());
		const registered = await registerToolForTest(new GetDayPlanItemsTool(service));

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
							measureQuantity: 1.23456,
							weight: 37.55555,
							capacity: 0.33333,
							energy: 24.13,
							protein: 3.85,
							fat: 0.96,
							carbohydrate: 6.15,
							fiber: 1.23,
							sugars: 2.35,
							salt: 0.15,
							eaten: false,
						},
						{
							itemId: "item-2",
							name: "Owsianka domowa",
							foodType: "RECIPE",
							recipeId: "456",
							measureId: "39",
							measureQuantity: 1,
							eaten: true,
						},
					],
				},
			],
		};

		expect(service.requests).toEqual([{ date: "2026-07-14", withRating: true }]);
		expect(registered.config.annotations).toMatchObject({ readOnlyHint: true, idempotentHint: true });
		expect(registered.config.outputSchema).toMatchObject({
			properties: {
				meals: {
					items: {
						properties: {
							mealKey: { type: "string" },
						},
					},
				},
			},
		});
		expect(result.structuredContent).toEqual(expectedContent);
		expect(parseTextContent(result)).toEqual(expectedContent);
	});

	it("rejects an invalid date before calling the service", async () => {
		const service = new FakeDayPlanQueryService(createDayPlan());
		const registered = await registerToolForTest(new GetDayPlanItemsTool(service));

		const result = await registered.invoke({ date: "14-07-2026" });

		expect(result.isError).toBe(true);
		expect(service.requests).toHaveLength(0);
	});

	it("rejects an impossible calendar date before calling the service", async () => {
		const service = new FakeDayPlanQueryService(createDayPlan());
		const registered = await registerToolForTest(new GetDayPlanItemsTool(service));

		const result = await registered.invoke({ date: "2026-02-30" });

		expect(result.isError).toBe(true);
		expect(service.requests).toHaveLength(0);
	});

	it("redacts an unexpected service error", async () => {
		const service = new FakeDayPlanQueryService(undefined, new Error("secret day plan response"));
		const registered = await registerToolForTest(new GetDayPlanItemsTool(service));

		const result = await registered.invoke({ date: "2026-07-14" });

		expect(parseTextContent(result)).toEqual({
			status: "error",
			toolName: "get_day_plan_items",
			error: {
				source: "internal",
				name: "Error",
				message: "Unable to fetch Fitatu day plan items.",
			},
		});
		expect(result.structuredContent).toBeUndefined();
		expect(getTextContent(result)).not.toContain("secret day plan response");
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
							measureQuantity: 1.23456,
							weight: 37.55555,
							capacity: 0.33333,
							energy: 24.126,
							protein: 3.8500000000000005,
							fat: 0.9625000000000001,
							carbohydrate: 6.1499999999999995,
							fiber: 1.234,
							sugars: 2.345,
							salt: 0.15000000000000002,
							eaten: false,
						},
						{
							planDayDietItemId: "item-2",
							name: "Owsianka domowa",
							foodType: "RECIPE",
							recipeId: 456,
							measureId: 39,
							measureQuantity: 1,
							eaten: true,
						},
					],
				},
			},
		},
	});
}
