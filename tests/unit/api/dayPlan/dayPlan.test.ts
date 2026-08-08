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

	it("accepts custom meal keys configured on the account", () => {
		const plan = DayPlan.fromApiResponse({
			date: "2026-07-12",
			userId: "user-1",
			data: {
				dietPlan: {
					breakfast: { items: [] },
					dinner: { items: [{ planDayDietItemId: "item-1", name: "Soup", productId: 101, energy: 52 }] },
					my_custom_meal: { items: [] },
				},
			},
		});

		expect(plan.meals.map((meal) => meal.mealKey)).toEqual(["breakfast", "dinner", "my_custom_meal"]);
		expect(plan.meals[1]?.items[0]).toMatchObject({ itemId: "item-1", name: "Soup" });
	});

	it("rejects malformed day-plan response shapes", () => {
		expect(() => DayPlan.fromApiResponse({ date: "2026-07-12", userId: "user-1", data: {} })).toThrow(
			"DayPlan response did not contain dietPlan",
		);
		expect(() =>
			DayPlan.fromApiResponse({
				date: "2026-07-12",
				userId: "user-1",
				data: { dietPlan: { " ": { items: [] } } },
			}),
		).toThrow("DayPlan response contained an empty meal key");
	});
});
