import { afterEach, describe, expect, it } from "vitest";
import { DayPlanClient } from "../../../src/api/dayPlan/DayPlanClient.ts";
import type { DayPlanItem } from "../../../src/api/dayPlan/DayPlanItem.ts";
import type { MealItemInput } from "../../../src/api/dayPlan/MealItemMutation.ts";
import { CleanupTracker } from "../helpers/cleanupTracker.ts";
import { findMealItem } from "../helpers/dayPlanAssertions.ts";
import { getIntegrationTestDate } from "../helpers/testDates.ts";

const dayPlanClient = new DayPlanClient();
const cleanup = new CleanupTracker(dayPlanClient);
const READ_AFTER_WRITE_ATTEMPTS = 20;
const MEAL_KEY = "breakfast";
const INCORRECT_BREAKFAST_ITEMS: readonly MealItemInput[] = [
	{
		foodId: "146822727",
		foodType: "PRODUCT",
		measureId: "2",
		measureQuantity: 0.5,
		eaten: true,
	},
	{
		foodId: "117741055",
		foodType: "PRODUCT",
		measureId: "1",
		measureQuantity: 40,
		eaten: true,
	},
	{
		foodId: "53858645",
		foodType: "PRODUCT",
		measureId: "1",
		measureQuantity: 62.5,
		eaten: true,
	},
	{
		foodId: "145823013",
		foodType: "PRODUCT",
		measureId: "2",
		measureQuantity: 0.5,
		eaten: true,
	},
	{
		foodId: "116885192",
		foodType: "PRODUCT",
		measureId: "1",
		measureQuantity: 75,
		eaten: true,
	},
];

describe.sequential("Fitatu sequential meal-item removal integration", () => {
	afterEach(async () => {
		await cleanup.cleanup();
	});

	it("removes batch-added breakfast products in one accepted day sync", async () => {
		const date = getIntegrationTestDate();
		const addResult = await dayPlanClient.addMealItems({
			date,
			mealKey: MEAL_KEY,
			items: INCORRECT_BREAKFAST_ITEMS,
		});

		expect(addResult.status).toBe("accepted");
		expect(addResult.operation).toBe("add");
		expect(addResult.operationCount).toBe(INCORRECT_BREAKFAST_ITEMS.length);
		expect(addResult.createdItemIds).toHaveLength(INCORRECT_BREAKFAST_ITEMS.length);

		for (const itemId of addResult.createdItemIds) {
			cleanup.track(date, MEAL_KEY, itemId);
			await waitForItem(date, MEAL_KEY, itemId);
		}

		const removeResult = await dayPlanClient.removeMealItems({
			date,
			productIds: INCORRECT_BREAKFAST_ITEMS.map((item) => requireFoodId(item.foodId)),
		});

		expect(removeResult.status).toBe("accepted");
		expect(removeResult.operation).toBe("remove");
		expect(removeResult.operationCount).toBeGreaterThanOrEqual(INCORRECT_BREAKFAST_ITEMS.length);
		expect(removeResult.deletedItemIds).toEqual(expect.arrayContaining([...addResult.createdItemIds]));
	}, 180_000);
});

async function waitForItem(date: string, mealKey: string, itemId: string): Promise<DayPlanItem> {
	for (let attempt = 0; attempt < READ_AFTER_WRITE_ATTEMPTS; attempt += 1) {
		const dayPlan = await dayPlanClient.getDayPlan({ date });
		const item = findMealItem(dayPlan, mealKey, itemId);
		if (item) {
			return item;
		}
		await wait(1_000);
	}

	throw new Error(`Meal item ${itemId} did not appear in ${mealKey} on ${date}`);
}

function requireFoodId(value: string | number | undefined): string {
	if (typeof value !== "string") {
		throw new Error("Expected test meal item to define foodId as a string");
	}

	return value;
}

function wait(milliseconds: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});
}
