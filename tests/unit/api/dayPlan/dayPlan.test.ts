import { describe, expect, it } from "vitest";
import { DayPlan } from "../../../../src/api/dayPlan/DayPlan.ts";

describe("DayPlan.fromApiResponse", () => {
	it("maps meals while preserving the requested date and user", () => {
		const plan = DayPlan.fromApiResponse({
			date: "2026-07-12",
			userId: "user-1",
			data: {
				dietPlan: {
					breakfast: { items: [{ planDayDietItemId: "item-1", name: "Apple", productId: 101, energy: 52 }] },
					lunch: { items: [] },
				},
			},
		});

		expect(plan.date).toBe("2026-07-12");
		expect(plan.userId).toBe("user-1");
		expect(plan.meals.map((meal) => meal.mealKey)).toEqual(["breakfast", "lunch"]);
		expect(plan.meals[0]?.items[0]).toMatchObject({ itemId: "item-1", name: "Apple", productId: 101, energy: 52 });
	});

	it("rejects a response without dietPlan", () => {
		expect(() => DayPlan.fromApiResponse({ date: "2026-07-12", userId: "user-1", data: {} })).toThrow(
			"DayPlan response did not contain dietPlan",
		);
	});
});
